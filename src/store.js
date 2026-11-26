// SQLite store for Tabula, modeled on the record kinds found in Notion's client:
//   collection                 -> databases
//   collection_property_schema -> properties
//   collection_view            -> views (format + query2)
//   block                      -> rows
//   block_property_value       -> row_values
// Every write arrives as a transaction of small operations (like Notion's
// createAndCommit) and is applied atomically, versioned and logged.
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS databases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS properties (
  id TEXT NOT NULL,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (database_id, id)
);
CREATE TABLE IF NOT EXISTS views (
  id TEXT NOT NULL,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT '{}',
  query2 TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (database_id, id)
);
CREATE TABLE IF NOT EXISTS rows (
  id TEXT NOT NULL,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (database_id, id)
);
CREATE TABLE IF NOT EXISTS row_values (
  database_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (database_id, row_id, property_id),
  FOREIGN KEY (database_id, row_id) REFERENCES rows(database_id, id) ON DELETE CASCADE,
  FOREIGN KEY (database_id, property_id) REFERENCES properties(database_id, id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  user_action TEXT NOT NULL,
  operations TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_by_db ON transactions(database_id, version);
`;

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const MAX_ROWS = 50_000; // like Notion's RowLimitExceededError
const PROPERTY_TYPES = new Set(["title", "text", "number", "select", "multi_select", "status", "date", "checkbox", "url", "email", "formula", "created_time", "relation", "rollup"]);
const VIEW_TYPES = new Set(["table", "board", "list"]);
const isId = v => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const needId = (v, what) => { if (!isId(v)) throw new HttpError(400, `${what} must be 1–64 letters, digits, - or _`); return v; };
const needStr = (v, what, max = 500) => { if (typeof v !== "string" || v.length > max) throw new HttpError(400, `${what} must be a string up to ${max} characters`); return v; };
const json = v => JSON.stringify(v ?? null);

export function openStore(file = ":memory:") {
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  const q = sql => db.prepare(sql);

  const stmt = {
    listDbs: q(`SELECT d.id, d.name, d.version, d.updated_at, (SELECT COUNT(*) FROM rows r WHERE r.database_id = d.id) AS row_count FROM databases d ORDER BY d.created_at`),
    getDb: q(`SELECT * FROM databases WHERE id = ?`),
    props: q(`SELECT * FROM properties WHERE database_id = ? ORDER BY position, rowid`),
    views: q(`SELECT * FROM views WHERE database_id = ? ORDER BY position, rowid`),
    rows: q(`SELECT * FROM rows WHERE database_id = ? ORDER BY position, created_at`),
    values: q(`SELECT row_id, property_id, value FROM row_values WHERE database_id = ?`),
    insDb: q(`INSERT INTO databases (id, name, version, created_at, updated_at) VALUES (?, ?, 0, ?, ?)`),
    renameDb: q(`UPDATE databases SET name = ? WHERE id = ?`),
    bump: q(`UPDATE databases SET version = version + 1, updated_at = ? WHERE id = ? RETURNING version`),
    delDb: q(`DELETE FROM databases WHERE id = ?`),
    upProp: q(`INSERT INTO properties (id, database_id, name, type, config, position) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(database_id, id) DO UPDATE SET name = excluded.name, type = excluded.type, config = excluded.config, position = excluded.position`),
    delProp: q(`DELETE FROM properties WHERE database_id = ? AND id = ?`),
    upView: q(`INSERT INTO views (id, database_id, name, type, format, query2, position) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(database_id, id) DO UPDATE SET name = excluded.name, type = excluded.type, format = excluded.format, query2 = excluded.query2, position = excluded.position`),
    delView: q(`DELETE FROM views WHERE database_id = ? AND id = ?`),
    countViews: q(`SELECT COUNT(*) AS n FROM views WHERE database_id = ?`),
    insRow: q(`INSERT INTO rows (id, database_id, body, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`),
    rowExists: q(`SELECT 1 FROM rows WHERE database_id = ? AND id = ?`),
    propExists: q(`SELECT type FROM properties WHERE database_id = ? AND id = ?`),
    countRows: q(`SELECT COUNT(*) AS n, COALESCE(MAX(position), 0) AS maxpos FROM rows WHERE database_id = ?`),
    setBody: q(`UPDATE rows SET body = ?, updated_at = ? WHERE database_id = ? AND id = ?`),
    touchRow: q(`UPDATE rows SET updated_at = ? WHERE database_id = ? AND id = ?`),
    delRow: q(`DELETE FROM rows WHERE database_id = ? AND id = ?`),
    setVal: q(`INSERT INTO row_values (database_id, row_id, property_id, value) VALUES (?, ?, ?, ?)
      ON CONFLICT(database_id, row_id, property_id) DO UPDATE SET value = excluded.value`),
    delVal: q(`DELETE FROM row_values WHERE database_id = ? AND row_id = ? AND property_id = ?`),
    log: q(`INSERT INTO transactions (id, database_id, version, user_action, operations, created_at) VALUES (?, ?, ?, ?, ?, ?)`),
    history: q(`SELECT id, version, user_action, operations, created_at FROM transactions WHERE database_id = ? ORDER BY version DESC LIMIT ?`),
  };

  function tx(fn) {
    db.exec("BEGIN IMMEDIATE");
    try { const r = fn(); db.exec("COMMIT"); return r; }
    catch (e) { db.exec("ROLLBACK"); throw e; }
  }

  function getDatabase(id) {
    const d = stmt.getDb.get(id);
    if (!d) return null;
    const schema = {};
    for (const p of stmt.props.all(id)) schema[p.id] = { name: p.name, type: p.type, ...JSON.parse(p.config) };
    const views = stmt.views.all(id).map(v => ({ id: v.id, name: v.name, type: v.type, format: JSON.parse(v.format), query2: JSON.parse(v.query2) }));
    const byRow = new Map();
    for (const v of stmt.values.all(id)) {
      if (!byRow.has(v.row_id)) byRow.set(v.row_id, {});
      byRow.get(v.row_id)[v.property_id] = JSON.parse(v.value);
    }
    const rows = stmt.rows.all(id).map(r => ({ id: r.id, created: r.created_at, updated: r.updated_at, body: r.body, props: byRow.get(r.id) || {} }));
    return { id: d.id, name: d.name, version: d.version, created: d.created_at, updated: d.updated_at, schema, views, rows };
  }

  function propertyRecord(p) {
    const { name, type, ...config } = p || {};
    needStr(name, "Property name", 200);
    if (!PROPERTY_TYPES.has(type)) throw new HttpError(400, `Unknown property type: ${type}`);
    return { name, type, config: json(config) };
  }
  function viewRecord(v) {
    needStr(v?.name, "View name", 200);
    if (!VIEW_TYPES.has(v.type)) throw new HttpError(400, `Unknown view type: ${v.type}`);
    const query2 = { filter: [], sort: [], aggregations: {}, ...(v.query2 || {}) };
    return { name: v.name, type: v.type, format: json(v.format || {}), query2: json(query2) };
  }

  // One operation. Each mirrors a kind of edit the client can make.
  function applyOp(dbId, op, now) {
    switch (op?.op) {
      case "rename_database": stmt.renameDb.run(needStr(op.name, "Database name", 200), dbId); return;
      case "set_property": {
        const r = propertyRecord(op.property);
        if (r.type === "title") {
          const existing = stmt.props.all(dbId).find(p => p.type === "title" && p.id !== op.id);
          if (existing) throw new HttpError(400, "A database has exactly one title property");
        }
        stmt.upProp.run(needId(op.id, "Property id"), dbId, r.name, r.type, r.config, Number(op.position) || 0); return;
      }
      case "delete_property": {
        const t = stmt.propExists.get(dbId, needId(op.id, "Property id"));
        if (t?.type === "title") throw new HttpError(400, "The title property can't be deleted");
        stmt.delProp.run(dbId, op.id); return;
      }
      case "set_view": { const r = viewRecord(op.view); stmt.upView.run(needId(op.id, "View id"), dbId, r.name, r.type, r.format, r.query2, Number(op.position) || 0); return; }
      case "delete_view":
        if (stmt.countViews.get(dbId).n <= 1) throw new HttpError(400, "A database needs at least one view");
        stmt.delView.run(dbId, needId(op.id, "View id")); return;
      case "add_row": {
        const c = stmt.countRows.get(dbId);
        if (c.n >= MAX_ROWS) throw new HttpError(406, `This database has reached its row limit of ${MAX_ROWS}. Delete rows to continue.`);
        const r = op.row || {};
        stmt.insRow.run(needId(r.id, "Row id"), dbId, needStr(r.body ?? "", "Row body", 100_000), c.maxpos + 1, Number(r.created) || now, now);
        for (const [pid, value] of Object.entries(r.props || {})) setValue(dbId, r.id, pid, value);
        return;
      }
      case "delete_row": stmt.delRow.run(dbId, needId(op.id, "Row id")); return;
      case "set_value": {
        if (!stmt.rowExists.get(dbId, needId(op.row_id, "Row id"))) throw new HttpError(404, `Row ${op.row_id} not found`);
        setValue(dbId, op.row_id, op.property_id, op.value); stmt.touchRow.run(now, dbId, op.row_id); return;
      }
      case "set_body":
        if (!stmt.rowExists.get(dbId, needId(op.row_id, "Row id"))) throw new HttpError(404, `Row ${op.row_id} not found`);
        stmt.setBody.run(needStr(op.body ?? "", "Row body", 100_000), now, dbId, op.row_id); return;
      default: throw new HttpError(400, `Unknown operation: ${op?.op}`);
    }
  }
  function setValue(dbId, rowId, propId, value) {
    const p = stmt.propExists.get(dbId, needId(propId, "Property id"));
    if (!p) throw new HttpError(400, `Property ${propId} doesn't exist`);
    if (p.type === "formula" || p.type === "created_time" || p.type === "rollup") return; // computed, never stored
    if (p.type === "relation" && value != null && (!Array.isArray(value) || !value.every(isId))) throw new HttpError(400, "A relation value must be a list of row ids");
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) stmt.delVal.run(dbId, rowId, propId);
    else { const s = json(value); if (s.length > 20_000) throw new HttpError(400, "Value is too large"); stmt.setVal.run(dbId, rowId, propId, s); }
  }

  function applyTransaction(dbId, { user_action = "edit", operations } = {}) {
    if (!Array.isArray(operations) || !operations.length) throw new HttpError(400, "operations must be a non-empty array");
    if (operations.length > 5000) throw new HttpError(400, "Too many operations in one transaction");
    return tx(() => {
      if (!stmt.getDb.get(dbId)) throw new HttpError(404, "Database not found");
      const now = Date.now();
      for (const op of operations) applyOp(dbId, op, now);
      const { version } = stmt.bump.get(now, dbId);
      stmt.log.run(randomUUID(), dbId, version, String(user_action).slice(0, 200), json(operations), now);
      return { version };
    });
  }

  function createDatabase(full) {
    const id = needId(full?.id ?? randomUUID().slice(0, 12), "Database id");
    const now = Date.now();
    return tx(() => {
      if (stmt.getDb.get(id)) throw new HttpError(409, "A database with that id already exists");
      stmt.insDb.run(id, needStr(full?.name ?? "Untitled database", "Database name", 200), now, now);
      const schema = full?.schema && Object.keys(full.schema).length ? full.schema : { title: { name: "Name", type: "title" } };
      if (Object.values(schema).filter(p => p.type === "title").length !== 1) throw new HttpError(400, "A database needs exactly one title property");
      Object.entries(schema).forEach(([pid, p], i) => applyOp(id, { op: "set_property", id: pid, property: p, position: i }, now));
      const views = full?.views?.length ? full.views : [{ id: "default", name: "Table", type: "table", format: { table_properties: Object.keys(schema).map(property => ({ property, visible: true, width: 200 })) } }];
      views.forEach((v, i) => applyOp(id, { op: "set_view", id: v.id, view: v, position: i }, now));
      for (const r of full?.rows || []) applyOp(id, { op: "add_row", row: r }, now);
      stmt.log.run(randomUUID(), id, 0, "create_database", "[]", now);
      return getDatabase(id);
    });
  }

  return {
    listDatabases: () => stmt.listDbs.all().map(d => ({ id: d.id, name: d.name, version: d.version, updated: d.updated_at, row_count: d.row_count })),
    getDatabase,
    createDatabase,
    deleteDatabase: id => tx(() => { if (!stmt.getDb.get(id)) throw new HttpError(404, "Database not found"); stmt.delDb.run(id); }),
    applyTransaction,
    history: (id, limit = 50) => stmt.history.all(id, Math.min(500, Math.max(1, limit))).map(t => ({ ...t, operations: JSON.parse(t.operations) })),
    close: () => db.close(),
  };
}

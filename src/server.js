// Tabula server: REST API over the SQLite store, live change events, and the web app.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { openStore, HttpError } from "./store.js";
import { runQuery, aggregate, sampleDb } from "../public/engine.js";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const MAX_BODY = 5 * 1024 * 1024;

export function createApp({ dbFile = ":memory:", token = "", seed = true } = {}) {
  const store = openStore(dbFile);
  if (seed && store.listDatabases().length === 0) {
    const s = sampleDb();
    delete s.example;
    s.id = "product-tasks";
    store.createDatabase(s);
  }
  const listeners = new Set(); // SSE clients

  const broadcast = event => {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of listeners) res.write(line);
  };

  const authorized = req => {
    if (!token) return true;
    const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || new URL(req.url, "http://x").searchParams.get("token") || "";
    const a = Buffer.from(given), b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  };

  async function body(req) {
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > MAX_BODY) throw new HttpError(413, "Request body is too large"); chunks.push(c); }
    if (!size) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpError(400, "Body must be valid JSON"); }
  }
  const send = (res, status, data) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(data)); };
  const mustGet = id => { const d = store.getDatabase(id); if (!d) throw new HttpError(404, "Database not found"); return d; };

  // Server-side query of a view (filters, sorts, calculations) with cursor paging.
  function query(dbId, input) {
    const d = mustGet(dbId);
    const base = input.view_id ? d.views.find(v => v.id === input.view_id) : null;
    if (input.view_id && !base) throw new HttpError(404, "View not found");
    const q2 = { filter: [], sort: [], aggregations: {}, ...(base?.query2 || {}) };
    if (Array.isArray(input.filter)) q2.filter = input.filter;
    if (Array.isArray(input.sort)) q2.sort = input.sort;
    if (input.aggregations && typeof input.aggregations === "object") q2.aggregations = input.aggregations;
    const all = runQuery(d, { query2: q2 });
    const limit = Math.min(500, Math.max(1, Number(input.limit) || 100));
    const start = Math.max(0, Number(input.cursor) || 0);
    const results = all.slice(start, start + limit);
    const aggregations = {};
    for (const [prop, agg] of Object.entries(q2.aggregations)) if (d.schema[prop]) aggregations[prop] = { aggregator: agg, value: aggregate(d, prop, all, agg) };
    return { results, total: all.length, has_more: start + limit < all.length, next_cursor: start + limit < all.length ? String(start + limit) : null, aggregations };
  }

  async function api(req, res, url) {
    const parts = url.pathname.split("/").filter(Boolean).slice(1); // after "api"
    const m = req.method;
    if (parts[0] === "health" && m === "GET") return send(res, 200, { ok: true });
    if (!authorized(req)) return send(res, 401, { error: "Missing or wrong access token" });

    if (parts[0] === "events" && m === "GET") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(": connected\n\n");
      listeners.add(res);
      const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
      req.on("close", () => { clearInterval(ping); listeners.delete(res); });
      return;
    }
    if (parts[0] !== "databases") throw new HttpError(404, "No such endpoint");
    const [, id, sub] = parts;
    const client = req.headers["x-client-id"] || null;

    if (!id && m === "GET") return send(res, 200, url.searchParams.get("full") ? store.listDatabases().map(d => store.getDatabase(d.id)) : store.listDatabases());
    if (!id && m === "POST") { const d = store.createDatabase(await body(req)); broadcast({ type: "created", id: d.id, version: d.version, client }); return send(res, 201, d); }
    if (id && !sub && m === "GET") return send(res, 200, mustGet(id));
    if (id && !sub && m === "DELETE") { store.deleteDatabase(id); broadcast({ type: "deleted", id, client }); return send(res, 200, { deleted: id }); }
    if (id && sub === "transactions" && m === "POST") {
      const r = store.applyTransaction(id, await body(req));
      broadcast({ type: "changed", id, version: r.version, client });
      return send(res, 200, r);
    }
    if (id && sub === "transactions" && m === "GET") { mustGet(id); return send(res, 200, store.history(id, Number(url.searchParams.get("limit")) || 50)); }
    if (id && sub === "query" && m === "POST") return send(res, 200, query(id, await body(req)));
    throw new HttpError(405, "Method not allowed");
  }

  async function staticFile(req, res, url) {
    let p = decodeURIComponent(url.pathname);
    if (p === "/") p = "/index.html";
    const file = normalize(join(PUBLIC, p));
    if (!file.startsWith(PUBLIC)) return send(res, 403, { error: "Forbidden" });
    try {
      const data = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
      res.end(data);
    } catch { send(res, 404, { error: "Not found" }); }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) await api(req, res, url);
      else if (req.method === "GET") await staticFile(req, res, url);
      else send(res, 405, { error: "Method not allowed" });
    } catch (e) {
      if (e instanceof HttpError) send(res, e.status, { error: e.message });
      else if (String(e?.code).startsWith("ERR_SQLITE")) send(res, 400, { error: "The change conflicts with existing data: " + e.message });
      else { console.error(e); send(res, 500, { error: "Something went wrong on the server" }); }
    }
  });
  server.on("close", () => { for (const r of listeners) r.end(); store.close(); });
  return { server, store };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "127.0.0.1";
  const { server } = createApp({ dbFile: process.env.TABULA_DB || "tabula.db", token: process.env.TABULA_TOKEN || "" });
  server.listen(port, host, () => console.log(`Tabula running at http://${host}:${port}  (database: ${process.env.TABULA_DB || "tabula.db"})`));
}

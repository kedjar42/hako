// Shared database engine: property types, formulas, filters, sorts and calculations.
// Used by the server (query API) and the browser (rendering), so both agree on results.

export const uid = () => Math.random().toString(36).slice(2, 9);

// ---- Property types (subset of the types found in Notion's bundle) ----
export const TYPES = {
  title: { label: "Title", ic: "Aa" }, text: { label: "Text", ic: "≡" }, number: { label: "Number", ic: "#" },
  select: { label: "Select", ic: "◉" }, multi_select: { label: "Multi-select", ic: "☰" }, status: { label: "Status", ic: "◐" },
  date: { label: "Date", ic: "▦" }, checkbox: { label: "Checkbox", ic: "☑" }, url: { label: "URL", ic: "↗" },
  email: { label: "Email", ic: "@" }, formula: { label: "Formula", ic: "ƒ" }, created_time: { label: "Created time", ic: "⏱" },
  relation: { label: "Relation", ic: "⇄" }, rollup: { label: "Rollup", ic: "Σ" },
};
// Rollup functions: how a rollup summarizes a property across the linked rows.
export const ROLLUP_FNS = [["count", "Count all"], ["count_values", "Count values"], ["sum", "Sum"], ["average", "Average"], ["median", "Median"], ["min", "Min"], ["max", "Max"], ["range", "Range"]];

// Relations and rollups read other databases. The server and the browser each say how to find one by id.
let resolveDb = () => null;
export const setResolver = fn => { resolveDb = typeof fn === "function" ? fn : () => null; };
export const getDb = id => (id ? resolveDb(id) : null);
export const COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
export const OPS = {
  text: [["contains", "contains"], ["not_contains", "does not contain"], ["is", "is"], ["is_empty", "is empty"], ["is_not_empty", "is not empty"]],
  number: [["eq", "="], ["neq", "≠"], ["gt", ">"], ["lt", "<"], ["gte", "≥"], ["lte", "≤"], ["is_empty", "is empty"], ["is_not_empty", "is not empty"]],
  select: [["is", "is"], ["is_not", "is not"], ["is_empty", "is empty"], ["is_not_empty", "is not empty"]],
  multi_select: [["contains", "contains"], ["not_contains", "does not contain"], ["is_empty", "is empty"], ["is_not_empty", "is not empty"]],
  date: [["is", "is"], ["before", "is before"], ["after", "is after"], ["is_empty", "is empty"], ["is_not_empty", "is not empty"]],
  checkbox: [["checked", "is checked"], ["unchecked", "is not checked"]],
  relation: [["contains", "contains"], ["not_contains", "does not contain"], ["is_empty", "is empty"], ["is_not_empty", "is not empty"]],
};
export const opKind = t => ({ title: "text", text: "text", url: "text", email: "text", formula: "text", number: "number", select: "select", status: "select", multi_select: "multi_select", date: "date", created_time: "date", checkbox: "checkbox", relation: "relation", rollup: "number" })[t];
export const AGGS = {
  _: [["none", "Calculate"], ["count", "Count all"], ["count_values", "Count values"], ["unique", "Count unique"], ["empty", "Count empty"], ["not_empty", "Count not empty"], ["percent_empty", "Percent empty"]],
  number: [["sum", "Sum"], ["average", "Average"], ["median", "Median"], ["min", "Min"], ["max", "Max"], ["range", "Range"]],
  checkbox: [["checked", "Checked"], ["unchecked", "Unchecked"], ["percent_checked", "Percent checked"]],
  date: [["earliest_date", "Earliest"], ["latest_date", "Latest"]],
};

// ---- Sample database ----
export function sampleDb() {
  const p = { title: "p_title", status: "p_status", owner: "p_owner", tags: "p_tags", due: "p_due", est: "p_est", done: "p_done", link: "p_link", score: "p_score", created: "p_created" };
  const now = Date.now(), day = 86400000, iso = d => new Date(now + d * day).toISOString().slice(0, 10);
  const schema = {
    [p.title]: { name: "Task", type: "title" },
    [p.status]: { name: "Status", type: "status", options: [{ id: "s1", value: "Not started", color: "gray" }, { id: "s2", value: "In progress", color: "blue" }, { id: "s3", value: "Done", color: "green" }] },
    [p.owner]: { name: "Owner", type: "select", options: [{ id: "o1", value: "Ana", color: "purple" }, { id: "o2", value: "Kofi", color: "orange" }, { id: "o3", value: "Mei", color: "pink" }] },
    [p.tags]: { name: "Tags", type: "multi_select", options: [{ id: "t1", value: "Design", color: "yellow" }, { id: "t2", value: "Backend", color: "blue" }, { id: "t3", value: "Docs", color: "brown" }, { id: "t4", value: "Bug", color: "red" }] },
    [p.due]: { name: "Due", type: "date" },
    [p.est]: { name: "Estimate (h)", type: "number" },
    [p.done]: { name: "Reviewed", type: "checkbox" },
    [p.score]: { name: "Cost", type: "formula", expression: 'prop("Estimate (h)") * 85' },
    [p.link]: { name: "Spec", type: "url" },
    [p.created]: { name: "Created", type: "created_time" },
  };
  const rows = [
    ["Redesign onboarding checklist", "s2", "o1", ["t1"], iso(3), 6, false, "https://example.com/spec/onboarding"],
    ["Fix CSV import encoding", "s1", "o2", ["t2", "t4"], iso(1), 3, false, ""],
    ["Write API pagination guide", "s2", "o3", ["t3"], iso(6), 4, false, ""],
    ["Add rate limiting to exports", "s1", "o2", ["t2"], iso(10), 8, false, "https://example.com/spec/limits"],
    ["Empty-state illustrations", "s3", "o1", ["t1"], iso(-2), 5, true, ""],
    ["Release notes for v2.4", "s3", "o3", ["t3"], iso(-1), 2, true, ""],
  ].map((r, i) => ({ id: uid(), created: now - (6 - i) * day * 1.3, body: "", props: { [p.title]: r[0], [p.status]: r[1], [p.owner]: r[2], [p.tags]: r[3], [p.due]: r[4], [p.est]: r[5], [p.done]: r[6], [p.link]: r[7] } }));
  const allProps = Object.keys(schema).map(k => ({ property: k, visible: true, width: k === p.title ? 260 : 150 }));
  return {
    id: "example-" + uid(), example: true, name: "Product tasks", schema, rows,
    views: [
      { id: uid(), name: "All tasks", type: "table", format: { table_properties: allProps }, query2: { filter: [], sort: [], aggregations: { [p.est]: "sum", [p.title]: "count", [p.done]: "percent_checked" } } },
      { id: uid(), name: "By status", type: "board", format: { board_columns_by: p.status, card_properties: [p.owner, p.tags, p.due] }, query2: { filter: [], sort: [{ property: p.due, direction: "ascending" }], aggregations: {} } },
      { id: uid(), name: "Open work", type: "list", format: { list_properties: [p.status, p.owner, p.due] }, query2: { filter: [{ property: p.status, op: "is_not", value: "s3" }], sort: [{ property: p.due, direction: "ascending" }], aggregations: {} } },
    ],
  };
}
// Two linked examples: books and their authors (a two-way relation, plus rollups on the author side).
export function sampleLibrary() {
  const R = { id: "reading-list", t: "r_title", author: "r_author", rating: "r_rating", status: "r_status", genre: "r_genre", done: "r_finished" };
  const A = { id: "authors", t: "a_name", avg: "a_avg", books: "a_books", count: "a_count", country: "a_country", born: "a_born" };
  const now = Date.now(), day = 86400000;
  const authors = [
    ["au1", "Ursula K. Le Guin", "c1", 1929], ["au2", "Don Norman", "c1", 1935], ["au3", "David Graeber", "c1", 1961], ["au4", "David Wengrow", "c2", 1972],
    ["au5", "Susanna Clarke", "c2", 1959], ["au6", "Siddhartha Mukherjee", "c3", 1970], ["au7", "Emily St. John Mandel", "c4", 1979],
  ];
  const books = [
    ["bk1", "The Left Hand of Darkness", ["au1"], 5, "st3", "g1", "2026-08-02"], ["bk2", "The Dispossessed", ["au1"], 4, "st3", "g1", "2026-09-14"],
    ["bk3", "The Design of Everyday Things", ["au2"], 4, "st3", "g2", "2026-10-21"], ["bk4", "The Dawn of Everything", ["au3", "au4"], null, "st2", "g3", ""],
    ["bk5", "Piranesi", ["au5"], null, "st1", "g4", ""], ["bk6", "The Gene", ["au6"], null, "st1", "g3", ""], ["bk7", "Station Eleven", ["au7"], null, "st2", "g4", ""],
  ];
  const reading = {
    id: R.id, name: "Reading list (example)",
    schema: {
      [R.t]: { name: "Title", type: "title" },
      [R.author]: { name: "Author", type: "relation", database_id: A.id, synced_property_id: A.books },
      [R.rating]: { name: "Rating", type: "number" },
      [R.status]: { name: "Status", type: "status", options: [{ id: "st1", value: "Want to read", color: "gray" }, { id: "st2", value: "Reading", color: "blue" }, { id: "st3", value: "Finished", color: "green" }] },
      [R.genre]: { name: "Genre", type: "select", options: [{ id: "g1", value: "Science fiction", color: "purple" }, { id: "g2", value: "Design", color: "yellow" }, { id: "g3", value: "Nonfiction", color: "brown" }, { id: "g4", value: "Fiction", color: "pink" }] },
      [R.done]: { name: "Finished on", type: "date" },
    },
    rows: books.map(([id, t, au, rating, st, g, d], i) => ({ id, created: now - (10 - i) * day, body: "", props: { [R.t]: t, [R.author]: au, [R.rating]: rating, [R.status]: st, [R.genre]: g, [R.done]: d } })),
    views: [
      { id: "rv_all", name: "All books", type: "table", format: { table_properties: [R.t, R.author, R.rating, R.status, R.genre, R.done].map(property => ({ property, visible: true, width: property === R.t ? 260 : 160 })) }, query2: { filter: [], sort: [], aggregations: { [R.rating]: "average" } } },
      { id: "rv_board", name: "By status", type: "board", format: { board_columns_by: R.status, card_properties: [R.author, R.rating] }, query2: { filter: [], sort: [], aggregations: {} } },
    ],
  };
  const authorsDb = {
    id: A.id, name: "Authors (example)",
    schema: {
      [A.t]: { name: "Name", type: "title" },
      [A.avg]: { name: "Average rating", type: "rollup", relation_property: A.books, target_property: R.rating, function: "average" },
      [A.books]: { name: "Books", type: "relation", database_id: R.id, synced_property_id: R.author },
      [A.count]: { name: "Book count", type: "rollup", relation_property: A.books, target_property: R.t, function: "count" },
      [A.country]: { name: "Country", type: "select", options: [{ id: "c1", value: "United States", color: "blue" }, { id: "c2", value: "United Kingdom", color: "red" }, { id: "c3", value: "India", color: "orange" }, { id: "c4", value: "Canada", color: "green" }] },
      [A.born]: { name: "Born", type: "number" },
    },
    rows: authors.map(([id, name, c, born], i) => ({ id, created: now - (20 - i) * day, body: "", props: { [A.t]: name, [A.books]: books.filter(b => b[2].includes(id)).map(b => b[0]), [A.country]: c, [A.born]: born } })),
    views: [{ id: "av_all", name: "All authors", type: "table", format: { table_properties: [A.t, A.avg, A.books, A.count, A.country, A.born].map(property => ({ property, visible: true, width: property === A.t ? 240 : property === A.books ? 240 : 150 })) }, query2: { filter: [], sort: [{ property: A.avg, direction: "descending" }], aggregations: {} } }],
  };
  return [reading, authorsDb];
}
export function blankDb() {
  const t = "p_" + uid(), s = "p_" + uid(), d = "p_" + uid();
  return { id: uid(), name: "Untitled database", schema: { [t]: { name: "Name", type: "title" }, [s]: { name: "Status", type: "status", options: [{ id: uid(), value: "Not started", color: "gray" }, { id: uid(), value: "In progress", color: "blue" }, { id: uid(), value: "Done", color: "green" }] }, [d]: { name: "Date", type: "date" } },
    rows: [], views: [{ id: uid(), name: "Table", type: "table", format: { table_properties: [t, s, d].map(property => ({ property, visible: true, width: property === t ? 260 : 150 })) }, query2: { filter: [], sort: [], aggregations: {} } }] };
}

export const titleProp = db => Object.keys(db.schema).find(k => db.schema[k].type === "title");
export const optOf = (prop, id) => prop.options?.find(o => o.id === id);

// ---- Values ----
export function evalFormula(db, prop, row) {
  try { return runFormula(prop.expression || "", name => { const k = Object.keys(db.schema).find(x => db.schema[x].name === name); if (!k) throw new Error("No property named " + name); return valueOf(db, k, row, true); }); }
  catch (e) { return { error: e.message }; }
}
export function valueOf(db, key, row, forFormula) {
  const p = db.schema[key]; if (!p) return null;
  const v = row.props[key];
  switch (p.type) {
    case "created_time": return row.created;
    case "formula": { const r = evalFormula(db, p, row); return r && r.error ? (forFormula ? null : r) : r; }
    case "select": case "status": return forFormula ? (optOf(p, v)?.value ?? "") : v ?? null;
    case "multi_select": return forFormula ? (v || []).map(id => optOf(p, id)?.value).filter(Boolean).join(", ") : v || [];
    case "checkbox": return !!v;
    case "relation": { const ids = Array.isArray(v) ? v : []; return forFormula ? relatedRows(db, key, row).map(r => r.title).join(", ") : ids; }
    case "rollup": return rollupValue(db, p, row);
    case "number": return v === "" || v === undefined || v === null ? null : Number(v);
    default: return v ?? (forFormula ? "" : null);
  }
}
// Rows in the linked database that this row points to (missing rows are skipped).
export function relatedRows(db, key, row) {
  const p = db.schema[key], target = p && getDb(p.database_id);
  const ids = Array.isArray(row.props[key]) ? row.props[key] : [];
  if (!target) return [];
  const t = titleProp(target), byId = new Map(target.rows.map(r => [r.id, r]));
  return ids.map(id => byId.get(id)).filter(Boolean).map(r => ({ id: r.id, title: (t && r.props[t]) || "Untitled", row: r }));
}
let rollupDepth = 0;
export function rollupValue(db, p, row) {
  const rel = db.schema[p.relation_property];
  if (!rel || rel.type !== "relation") return null;
  const target = getDb(rel.database_id);
  if (!target || !target.schema[p.target_property] || rollupDepth > 6) return null;
  const linked = relatedRows(db, p.relation_property, row).map(x => x.row);
  const fn = p.function || "count";
  if (fn === "count") return linked.length;
  rollupDepth++;
  try {
    const vals = linked.map(r => valueOf(target, p.target_property, r));
    if (fn === "count_values") return vals.filter(v => !isEmpty(v)).length;
    const nums = vals.filter(v => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
    if (!nums.length) return fn === "sum" ? 0 : null;
    const total = nums.reduce((s, v) => s + v, 0);
    return { sum: total, average: total / nums.length, min: nums[0], max: nums.at(-1), range: nums.at(-1) - nums[0], median: nums.length % 2 ? nums[(nums.length - 1) / 2] : (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2 }[fn] ?? null;
  } finally { rollupDepth--; }
}
export function displayText(db, key, row) {
  const p = db.schema[key], v = valueOf(db, key, row);
  if (v === null || v === undefined || v === "") return "";
  if (p.type === "select" || p.type === "status") return optOf(p, v)?.value ?? "";
  if (p.type === "multi_select") return v.map(id => optOf(p, id)?.value).filter(Boolean).join(", ");
  if (p.type === "date") return fmtDate(v);
  if (p.type === "created_time") return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (p.type === "checkbox") return v ? "Yes" : "No";
  if (p.type === "formula") return v && v.error ? "Error" : typeof v === "number" ? fmtNum(v) : String(v);
  if (p.type === "number" || p.type === "rollup") return fmtNum(v);
  if (p.type === "relation") return relatedRows(db, key, row).map(r => r.title).join(", ");
  return String(v);
}
export const fmtNum = n => Number.isFinite(n) ? (Math.round(n * 100) / 100).toLocaleString(undefined, { useGrouping: false, maximumFractionDigits: 2 }) : "";
export const fmtDate = s => { const d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); };
export const isEmpty = v => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length) || (v && v.error);

// Tiny formula language: numbers, "strings", prop("Name"), + - * / ( ), comparisons, and round/abs/min/max/if/concat/length/now.
export function runFormula(src, prop) {
  const toks = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) { let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++; toks.push({ t: "n", v: parseFloat(src.slice(i, j)) }); i = j; continue; }
    if (c === '"') { let j = i + 1, s = ""; while (j < src.length && src[j] !== '"') s += src[j++]; if (src[j] !== '"') throw new Error("Unclosed quote"); toks.push({ t: "s", v: s }); i = j + 1; continue; }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (j < src.length && /[A-Za-z_0-9]/.test(src[j])) j++; toks.push({ t: "id", v: src.slice(i, j) }); i = j; continue; }
    const two = src.slice(i, i + 2);
    if ([">=", "<=", "==", "!="].includes(two)) { toks.push({ t: "op", v: two }); i += 2; continue; }
    if ("+-*/(),<>".includes(c)) { toks.push({ t: "op", v: c }); i++; continue; }
    throw new Error("Unexpected " + c);
  }
  let k = 0; const peek = () => toks[k], eat = v => { if (toks[k]?.v !== v) throw new Error("Expected " + v); k++; };
  const fns = { round: (a, d = 0) => Math.round(a * 10 ** d) / 10 ** d, abs: Math.abs, min: Math.min, max: Math.max, if: (c, a, b) => (c ? a : b), concat: (...a) => a.join(""), length: s => String(s).length, now: () => new Date().toISOString().slice(0, 10), floor: Math.floor, ceil: Math.ceil };
  function primary() {
    const t = toks[k++]; if (!t) throw new Error("Formula ends early");
    if (t.t === "n" || t.t === "s") return t.v;
    if (t.v === "(") { const v = cmp(); eat(")"); return v; }
    if (t.v === "-") return -primary();
    if (t.t === "id") {
      if (t.v === "true") return true; if (t.v === "false") return false;
      eat("("); const args = []; if (peek()?.v !== ")") { args.push(cmp()); while (peek()?.v === ",") { k++; args.push(cmp()); } } eat(")");
      if (t.v === "prop") return prop(String(args[0]));
      if (!fns[t.v]) throw new Error("Unknown function " + t.v); return fns[t.v](...args);
    }
    throw new Error("Unexpected " + t.v);
  }
  function term() { let v = primary(); while (peek() && "*/".includes(peek().v)) { const o = toks[k++].v, r = primary(); v = o === "*" ? Number(v) * Number(r) : Number(v) / Number(r); } return v; }
  function sum() { let v = term(); while (peek() && "+-".includes(peek().v) && peek().t === "op") { const o = toks[k++].v, r = term(); v = o === "+" ? (typeof v === "string" || typeof r === "string" ? String(v ?? "") + String(r ?? "") : Number(v) + Number(r)) : Number(v) - Number(r); } return v; }
  function cmp() { let v = sum(); while (peek() && [">", "<", ">=", "<=", "==", "!="].includes(peek().v)) { const o = toks[k++].v, r = sum(); v = { ">": v > r, "<": v < r, ">=": v >= r, "<=": v <= r, "==": v == r, "!=": v != r }[o]; } return v; }
  if (!toks.length) return "";
  const out = cmp(); if (k < toks.length) throw new Error("Unexpected " + toks[k].v);
  return typeof out === "number" && !Number.isFinite(out) ? null : out;
}

// ---- Query: filter → sort (like a view's query2) ----
export function passes(db, f, row) {
  const p = db.schema[f.property]; if (!p) return true;
  const v = valueOf(db, f.property, row), kind = opKind(p.type);
  if (f.op === "is_empty") return isEmpty(v);
  if (f.op === "is_not_empty") return !isEmpty(v);
  if (kind === "checkbox") return f.op === "checked" ? !!v : !v;
  if (f.value === "" || f.value === undefined) return true;
  if (kind === "text") { const s = (p.type === "formula" ? displayText(db, f.property, row) : String(v ?? "")).toLowerCase(), q = String(f.value).toLowerCase(); return f.op === "contains" ? s.includes(q) : f.op === "not_contains" ? !s.includes(q) : s === q; }
  if (kind === "number") { const n = Number(v), q = Number(f.value); if (v === null) return f.op === "neq"; return { eq: n === q, neq: n !== q, gt: n > q, lt: n < q, gte: n >= q, lte: n <= q }[f.op]; }
  if (kind === "select") return f.op === "is" ? v === f.value : v !== f.value;
  if (kind === "multi_select" || kind === "relation") return f.op === "contains" ? (v || []).includes(f.value) : !(v || []).includes(f.value);
  if (kind === "date") { const d = p.type === "created_time" ? new Date(v).toISOString().slice(0, 10) : v; if (!d) return false; return f.op === "is" ? d === f.value : f.op === "before" ? d < f.value : d > f.value; }
  return true;
}
export function sortKey(db, key, row) {
  const p = db.schema[key], v = valueOf(db, key, row);
  if (p.type === "select" || p.type === "status") { const i = p.options.findIndex(o => o.id === v); return i < 0 ? null : i; }
  if (p.type === "multi_select" || p.type === "relation") return displayText(db, key, row).toLowerCase() || null;
  if (p.type === "formula") return v && v.error ? null : v;
  if (typeof v === "string") return v.toLowerCase() || null;
  return v;
}
export function runQuery(db, view) {
  let rows = db.rows.filter(r => view.query2.filter.every(f => passes(db, f, r)));
  const sorts = view.query2.sort.filter(s => db.schema[s.property]);
  if (sorts.length) rows = rows.slice().sort((a, b) => {
    for (const s of sorts) {
      const x = sortKey(db, s.property, a), y = sortKey(db, s.property, b);
      if (x === y) continue; if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1;
      const c = x < y ? -1 : 1; return s.direction === "descending" ? -c : c;
    }
    return 0;
  });
  return rows;
}
export function aggregate(db, key, rows, agg) {
  const vals = rows.map(r => valueOf(db, key, r)), n = rows.length;
  const filled = vals.filter(v => !isEmpty(v) && v !== false);
  const nums = vals.filter(v => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  const pct = x => n ? Math.round(x / n * 100) + "%" : "0%";
  switch (agg) {
    case "count": return n;
    case "count_values": return ["multi_select", "relation"].includes(db.schema[key].type) ? vals.reduce((s, v) => s + (v?.length || 0), 0) : filled.length;
    case "unique": return new Set(filled.map(v => JSON.stringify(v))).size;
    case "empty": return n - filled.length;
    case "not_empty": return filled.length;
    case "percent_empty": return pct(n - filled.length);
    case "sum": return fmtNum(nums.reduce((s, v) => s + v, 0));
    case "average": return nums.length ? fmtNum(nums.reduce((s, v) => s + v, 0) / nums.length) : "–";
    case "median": return nums.length ? fmtNum(nums.length % 2 ? nums[(nums.length - 1) / 2] : (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2) : "–";
    case "min": return nums.length ? fmtNum(nums[0]) : "–";
    case "max": return nums.length ? fmtNum(nums.at(-1)) : "–";
    case "range": return nums.length ? fmtNum(nums.at(-1) - nums[0]) : "–";
    case "checked": return vals.filter(Boolean).length;
    case "unchecked": return vals.filter(v => !v).length;
    case "percent_checked": return pct(vals.filter(Boolean).length);
    case "earliest_date": { const d = vals.filter(Boolean).map(v => typeof v === "number" ? new Date(v).toISOString().slice(0, 10) : v).sort()[0]; return d ? fmtDate(d) : "–"; }
    case "latest_date": { const d = vals.filter(Boolean).map(v => typeof v === "number" ? new Date(v).toISOString().slice(0, 10) : v).sort().at(-1); return d ? fmtDate(d) : "–"; }
  }
  return "";
}
export const aggOptions = type => [...AGGS._, ...(type === "number" || type === "formula" || type === "rollup" ? AGGS.number : []), ...(type === "checkbox" ? AGGS.checkbox : []), ...(type === "date" || type === "created_time" ? AGGS.date : [])];

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server.js";

let server, base;
const TOKEN = "test-token";
before(async () => {
  ({ server } = createApp({ dbFile: ":memory:", token: TOKEN }));
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

const call = async (method, path, body, auth = true) => {
  const res = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer " + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
};

test("rejects requests without the token", async () => {
  assert.equal((await call("GET", "/databases", null, false)).status, 401);
  assert.equal((await call("GET", "/health", null, false)).status, 200);
});

test("seeds the two linked example databases on first run", async () => {
  const { data } = await call("GET", "/databases");
  assert.deepEqual(data.map(d => [d.id, d.row_count]), [["reading-list", 7], ["authors", 7]]);
});

test("relations and rollups resolve across databases in queries", async () => {
  const q = await call("POST", "/databases/authors/query", { view_id: "av_all", limit: 2 });
  assert.equal(q.data.results[0].props.a_name, "Ursula K. Le Guin");
  assert.deepEqual(q.data.results[0].props.a_books, ["bk1", "bk2"]);
  const byAuthor = await call("POST", "/databases/reading-list/query", { filter: [{ property: "r_author", op: "contains", value: "au1" }] });
  assert.equal(byAuthor.data.total, 2);
  const avg = await call("POST", "/databases/authors/query", { filter: [{ property: "a_avg", op: "gte", value: "4.5" }] });
  assert.deepEqual(avg.data.results.map(r => r.props.a_name), ["Ursula K. Le Guin"]);
  const bad = await call("POST", "/databases/authors/transactions", { operations: [{ op: "set_value", row_id: "au1", property_id: "a_books", value: "bk1" }] });
  assert.equal(bad.status, 400);
});

test("create, edit through a transaction, query, and read history", async () => {
  const created = await call("POST", "/databases", {
    id: "books", name: "Reading list",
    schema: { t: { name: "Title", type: "title" }, pages: { name: "Pages", type: "number" }, st: { name: "Status", type: "status", options: [{ id: "a", value: "To read", color: "gray" }, { id: "b", value: "Done", color: "green" }] }, f: { name: "Hours", type: "formula", expression: 'round(prop("Pages") / 40, 1)' } },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.views.length, 1);

  const tx = await call("POST", "/databases/books/transactions", { user_action: "Add books", operations: [
    { op: "add_row", row: { id: "r1", props: { t: "Dune", pages: 412, st: "a" } } },
    { op: "add_row", row: { id: "r2", props: { t: "Piranesi", pages: 245, st: "b" } } },
    { op: "add_row", row: { id: "r3", props: { t: "Hyperion", pages: 482 } } },
    { op: "set_value", row_id: "r3", property_id: "st", value: "a" },
  ] });
  assert.deepEqual(tx.data, { version: 1 });

  const q = await call("POST", "/databases/books/query", {
    filter: [{ property: "st", op: "is", value: "a" }],
    sort: [{ property: "pages", direction: "descending" }],
    aggregations: { pages: "sum", f: "max" }, limit: 1,
  });
  assert.equal(q.data.total, 2);
  assert.equal(q.data.results[0].props.t, "Hyperion");
  assert.equal(q.data.has_more, true);
  assert.equal(q.data.aggregations.pages.value, (894).toLocaleString());
  assert.equal(q.data.aggregations.f.value, "12.1");
  const page2 = await call("POST", "/databases/books/query", { filter: [{ property: "st", op: "is", value: "a" }], sort: [{ property: "pages", direction: "descending" }], limit: 1, cursor: q.data.next_cursor });
  assert.equal(page2.data.results[0].props.t, "Dune");

  const hist = await call("GET", "/databases/books/transactions");
  assert.equal(hist.data[0].user_action, "Add books");
  assert.equal(hist.data[0].operations.length, 4);
});

test("a failing operation rolls back the whole transaction", async () => {
  const r = await call("POST", "/databases/books/transactions", { operations: [
    { op: "set_value", row_id: "r1", property_id: "pages", value: 999 },
    { op: "delete_property", id: "t" },
  ] });
  assert.equal(r.status, 400);
  const d = await call("GET", "/databases/books");
  assert.equal(d.data.rows.find(x => x.id === "r1").props.pages, 412);
  assert.equal(d.data.version, 1);
});

test("deleting a property removes its values; deleting a database cascades", async () => {
  await call("POST", "/databases/books/transactions", { operations: [{ op: "delete_property", id: "pages" }] });
  const d = await call("GET", "/databases/books");
  assert.equal(d.data.schema.pages, undefined);
  assert.equal(d.data.rows[0].props.pages, undefined);
  assert.equal((await call("DELETE", "/databases/books")).status, 200);
  assert.equal((await call("GET", "/databases/books")).status, 404);
});

test("validates input", async () => {
  assert.equal((await call("POST", "/databases", { schema: { a: { name: "A", type: "text" } } })).status, 400);
  assert.equal((await call("POST", "/databases/authors/transactions", { operations: [{ op: "nope" }] })).status, 400);
  assert.equal((await call("POST", "/databases/authors/transactions", { operations: [{ op: "add_row", row: { id: "bad id!" } }] })).status, 400);
});

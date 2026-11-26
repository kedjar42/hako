# hako

polyvalent. Contains **Tabula**, a self-hosted, Notion-style database app (Node.js + SQLite) with a web UI and JSON API.

A small, self-hosted, Notion-style database app. One Node.js process serves the web
app and stores everything in a single SQLite file. No dependencies to install.

- Typed properties: title, text, number, select, multi-select, status, date,
  checkbox, URL, email, formula, created time, relation and rollup
- Linked databases: a relation links rows across two databases in both directions,
  and a rollup summarizes the linked rows (count, sum, average, min, max…)
- Search titles, filter, sort, and choose which properties each view shows
- Table, board (drag cards between columns) and list views, each with its own
  filters, sorts and column calculations
- Every edit is saved as a transaction; Ctrl/⌘+Z undoes it
- Open tabs update live when something changes
- A JSON API for scripts and other apps

## Run it

Requires Node.js 22.13 or newer (it uses the built-in `node:sqlite`).

```bash
npm start
```

Then open http://127.0.0.1:3000. The first run creates `tabula.db` with an
two linked examples, "Reading list" and "Authors"
(each author's average rating and book count are rollups over their books).

Settings are environment variables:

| Variable       | Default     | Meaning                                                  |
|----------------|-------------|----------------------------------------------------------|
| `PORT`         | `3000`      | Port to listen on                                        |
| `HOST`         | `127.0.0.1` | Address to bind; use `0.0.0.0` to allow other machines   |
| `TABULA_DB`    | `tabula.db` | Path of the SQLite file                                  |
| `TABULA_TOKEN` | (none)      | If set, every API call needs this token                  |

To open the app with a token, add it to the address once:
`http://your-server:3000/?token=YOUR_TOKEN` (the browser remembers it).

Set `TABULA_TOKEN` whenever `HOST` is not `127.0.0.1`. To back up, copy
`tabula.db` (and `tabula.db-wal` if present) while the server is stopped.

```bash
npm test
```

## How the data is stored

The tables follow the record kinds found in Notion's own client:

| Tabula table   | Notion record                | Holds                                         |
|----------------|------------------------------|-----------------------------------------------|
| `databases`    | `collection`                 | Name and a version number bumped on each write |
| `properties`   | `collection_property_schema` | Name, type, options, formula, column order    |
| `views`        | `collection_view`            | `format` (layout) and `query2` (filter, sort, calculations) |
| `rows`         | `block`                      | Page body and timestamps                      |
| `row_values`   | `block_property_value`       | One JSON value per row and property           |
| `transactions` | transaction queue            | Every write, with its operations, for history |

Deleting a property removes its values; deleting a database removes everything
in it. Formula, rollup and created-time values are computed, never stored.

A relation property stores a list of row ids from another database
(`{ "type": "relation", "database_id": "authors", "synced_property_id": "a_books" }`).
With `synced_property_id`, the other database has a matching property and the web
app keeps both sides in step. A rollup names a relation, a property in the linked
database and a function:
`{ "type": "rollup", "relation_property": "a_books", "target_property": "r_rating", "function": "average" }`.
Queries resolve both across databases.

## API

Send `Authorization: Bearer <token>` when a token is set.

| Method & path                              | Does                                              |
|--------------------------------------------|---------------------------------------------------|
| `GET /api/databases`                       | List databases (`?full=1` for full contents)      |
| `POST /api/databases`                      | Create one (optional `id`, `name`, `schema`, `views`, `rows`) |
| `GET /api/databases/:id`                   | Schema, views and rows                            |
| `DELETE /api/databases/:id`                | Delete it                                         |
| `POST /api/databases/:id/transactions`     | Apply operations atomically                       |
| `GET /api/databases/:id/transactions`      | Recent history (`?limit=50`)                      |
| `POST /api/databases/:id/query`            | Filter, sort, calculate and page through rows     |
| `GET /api/events`                          | Server-sent events when anything changes          |

A transaction is all-or-nothing:

```json
{
  "user_action": "Add books",
  "operations": [
    { "op": "add_row", "row": { "id": "r1", "props": { "title": "Dune", "pages": 412 } } },
    { "op": "set_value", "row_id": "r1", "property_id": "pages", "value": 420 },
    { "op": "set_body", "row_id": "r1", "body": "Notes…" },
    { "op": "set_value", "row_id": "r1", "property_id": "author", "value": ["au1"] }
  ]
}
```

Operations: `rename_database`, `set_property`, `delete_property`, `set_view`,
`delete_view`, `add_row`, `delete_row`, `set_value`, `set_body`.

A query uses a saved view, or its own filter and sort:

```json
{
  "view_id": "optional",
  "filter": [{ "property": "st", "op": "is", "value": "a" }],
  "sort": [{ "property": "pages", "direction": "descending" }],
  "aggregations": { "pages": "sum" },
  "limit": 100,
  "cursor": null
}
```

The response has `results`, `total`, `has_more`, `next_cursor` and
`aggregations`. Filtering and sorting use the same code as the browser
(`public/engine.js`), so the API and the screen agree.

## Formulas

`prop("Name")`, numbers, `"text"`, `+ - * /`, comparisons, and `round`, `abs`,
`min`, `max`, `floor`, `ceil`, `if`, `concat`, `length`, `now`. Example:
`if(prop("Pages") > 400, "Long", "Short")`.

## Limits

- 50,000 rows per database.
- Any client holding the token can read and change everything; there are no
  per-user accounts.
- Edits to the same field from two tabs: the last write wins.
- The API stores what it is sent: a client that edits one side of a two-way
  relation through the API should also update the other side (the web app does).

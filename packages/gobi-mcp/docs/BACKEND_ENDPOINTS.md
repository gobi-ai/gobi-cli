# Backend endpoints the MCP server needs

The MCP package talks to Gobi over the same HTTP API gobi-cli uses (`GOBI_BASE_URL`, default `https://api.joingobi.com`). This document lists **what already exists** (as called from gobi-cli) and **what the MCP OAuth / People / notes-search layers expect but gobi-cli does not yet call**.

Where an endpoint is missing, the MCP server implements a typed interface (`AuthServerAdapter`, `PeopleDirectory`, `NoteSearch`) with an in-memory mock used by tests and e2e. Production calls go through the HTTP adapters; a 404/501 is returned to the agent as `{ unimplemented: true, endpoint, todo }` rather than invented data.

People DB extract/merge is owned by Jimin — those routes are not in gobi-cli today.

## Already used (gobi-cli)

| Method | Path | Used for |
|--------|------|----------|
| GET | `/auth/me` | `gobi_whoami` |
| POST | `/auth/connect-token/exchange` `{ token }` | `gbi_` connect-token login |
| POST | `/auth/device` | Device-code login (CLI) |
| POST | `/auth/device/token` `{ deviceCode }` | Device-code poll |
| POST | `/auth/refresh` `{ refreshToken }` | Token refresh |
| GET | `/app/activities` | list activities |
| GET | `/app/activity/:id` | get activity |
| GET | `/app/conversations` | list notes |
| GET | `/app/conversations/:id/transcript` | get note |
| GET | `/notifications` | captures |
| GET | `/spaces`, `/spaces/:slug/posts`, `/spaces/:slug/search` | space tools (phase 3, opt-in) |
| POST | `/spaces/:slug/posts/:id/replies` | space reply (phase 3) |
| POST | `/posts/:id/replies` | personal reply (phase 3) |

## Needed for remote MCP OAuth 2.1 (Gobi as AS)

The MCP server currently **implements these itself** (in-process store + PKCE) and optionally **exchanges** a `gbi_` / device-code session against the rows above. A production Gobi authorization server should replace the in-process store.

| Method | Path | Spec | Status |
|--------|------|------|--------|
| GET | `/.well-known/oauth-protected-resource` | RFC 9728 | Served by MCP (`resource` = `https://mcp.gobispace.com/mcp`) |
| GET | `/.well-known/oauth-authorization-server` | RFC 8414 | Served by MCP |
| POST | `/oauth/register` | RFC 7591 DCR | Served by MCP (in-memory clients) |
| GET/POST | `/oauth/authorize` | OAuth 2.1 + PKCE S256 | Served by MCP; user proves Gobi identity with `gobi_token` |
| POST | `/oauth/token` | authorization_code + refresh_token | Served by MCP |
| POST | `/oauth/introspect` | RFC 7662 | Served by MCP |
| POST | `/auth/oauth/token` | Gobi-native code exchange | **TODO backend** — MCP would POST `{ code, code_verifier, client_id }` |
| GET | `/auth/oauth/authorize` | Gobi-hosted login UI | **TODO backend** |
| POST | `/auth/workos/exchange` `{ workosAccessToken }` | Map WorkOS user → Gobi access token | **TODO backend** (WorkOS adapter) |

Durable storage (Redis/Postgres) for DCR clients, auth codes, and refresh tokens is also a **TODO backend** — the MCP process store is not shared across Vercel isolates.

## Needed for notes search

| Method | Path | Status |
|--------|------|--------|
| GET | `/app/conversations/search?q=&limit=&before=` | **TODO backend** — not in gobi-cli. MCP `HttpNoteSearch` calls this; 404 → unimplemented. |

There is post search (`/posts/personal-space/search`, `/spaces/:slug/search`) but that is **posts**, not Sense notes.

## Needed for People DB (Jimin)

| Method | Path | Status |
|--------|------|--------|
| GET | `/app/people?q=&limit=` | **TODO backend** — list / search |
| GET | `/app/people/:id` | **TODO backend** — get person |
| POST | `/app/people/extract` | **TODO backend** — extract people from notes (not exposed as an MCP tool yet) |
| POST | `/app/people/merge` | **TODO backend** — merge identities (not exposed as an MCP tool yet) |

MCP tools `gobi_list_people` / `gobi_get_person` call the GET routes through `HttpPeopleDirectory`. Tests use `InMemoryPeopleDirectory`.

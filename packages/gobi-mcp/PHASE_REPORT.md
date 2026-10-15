# Phase report — `@gobi-ai/mcp`

Evaluation after each implemented phase. Tests are `cd packages/gobi-mcp && npm test` (`tsc` then `node --test`, mocked Gobi API only — no production, no deploy, no npm publish, no DNS).

## Phase 0–1 (prior commit)

Read-only personal MCP: stdio + Streamable HTTP, `gobi_get_personal_context` and the other phase-1 tools, Gobi-first instructions, `gobi://personal/daily-snapshot`, catch-up / evening-debrief / people-met-today prompts.

- Commits: `1fe914c`, `ded7a35`
- PR: https://github.com/gobi-ai/gobi-cli/pull/117

## Phase 2

**Date:** 2026-10-15

### Tests

```
cd packages/gobi-mcp && npm test
# tests 46
# suites 14
# pass 46
# fail 0
# duration_ms ~600
```

Suites: auth, People + notes search, e2e smoke, Gobi API client, parseSince / parseContextLimit / speakersFromTurns, fetchPersonalContext, other personal reads, HTTP auth, OAuth 2.1 AS, OpenAPI catalog, REST /v1, Gobi MCP server.

### E2E smoke (SDK client, mocked backend)

`src/e2e-smoke.test.ts` starts `startMockGobiBackend()` (notes, activities, captures, `/auth/me`, `/app/people`, `/app/conversations/search`, connect-token and WorkOS exchange stubs) then:

| Transport | What ran |
|-----------|----------|
| **HTTP** | `createGobiHttpHandler` on an ephemeral port. RFC 9728 PRM, DCR + PKCE S256 + token, `GET /v1/whoami` + `/v1/people` + `/v1/openapi.json`, then `@modelcontextprotocol/client` `StreamableHTTPClientTransport` against `/mcp` with the issued bearer. `listTools` matches the phase-2 catalog; `gobi_whoami` and `gobi_list_people` return Ada / Min. |
| **stdio** | Spawns `node dist/index.js` with `GOBI_API_KEY` + `GOBI_BASE_URL` pointing at the mock. `StdioClientTransport` lists the same tools and calls `gobi_whoami` / `gobi_list_people`. |

Both passed (~170 ms HTTP, ~220 ms stdio).

### Delivered

- OAuth 2.1 AS: PRM, AS metadata, DCR, PKCE S256, authorization_code + refresh_token, introspect. Identity via `gobi_token` (`gbi_` exchange or raw Gobi access token). Pluggable `AuthServerAdapter`; `GOBI_MCP_AUTH_ADAPTER=workos` selects WorkOS User Management then `POST /auth/workos/exchange`.
- `gobi_search_notes`, `gobi_list_people`, `gobi_get_person`. HTTP adapters call documented paths; 404/501 → `{ unimplemented, endpoint, todo }`. In-memory mocks for tests. People DB extract/merge is **not** in gobi-cli (Jimin); not exposed as tools.
- Generated OpenAPI 3.1 from `src/catalog.ts` (`openapi.json`, `GET /v1/openapi.json`) and REST `/v1/*` mapping the same core.
- Backend contract: [`docs/BACKEND_ENDPOINTS.md`](docs/BACKEND_ENDPOINTS.md).

### Backend TODOs (not invented)

| Gap | MCP behavior until it ships |
|-----|-----------------------------|
| Gobi-hosted `/auth/oauth/authorize` + `/auth/oauth/token` | Local AS; login HTML / `gobi_token` |
| Durable DCR/code/token store | In-process `MemoryOAuthStore` (not shared across Vercel isolates) |
| `POST /auth/workos/exchange` | WorkOS adapter; mocked in tests |
| `GET /app/conversations/search` | `HttpNoteSearch` → unimplemented |
| `GET /app/people`, `GET /app/people/:id` | `HttpPeopleDirectory` → unimplemented |
| `POST /app/people/extract`, `POST /app/people/merge` | Documented only; no MCP tools |

Phase 3 is a later commit on this branch.

## Phase 3

**Date:** 2026-10-15

### Tests

```
cd packages/gobi-mcp && npm test
# tests 57
# suites 16
# pass 57
# fail 0
# duration_ms ~750
```

New coverage: confirm tokens, posts helpers, REST two-step reply + space 404-until-opt-in, MCP two-step `gobi_reply_to_post`, MCP `elicitation/create` accept → POST `/posts/:id/replies`, space tools only when `enableSpaceTools` is set.

### E2E smoke (SDK client, mocked backend)

Same `src/e2e-smoke.test.ts` against `startMockGobiBackend()` (now also stubs space list/search and personal/space replies):

| Transport | What ran |
|-----------|----------|
| **HTTP** | Phase-2 OAuth + MCP reads, then two-step `gobi_reply_to_post` (`needsConfirmation` → echo `confirmToken` → `r0123456789`). Separate case with `enableSpaceTools` + `spaceSlug=demo` lists `gobi_list_space_posts` and returns the standup post. |
| **stdio** | Spawned `node dist/index.js` lists default tools (write included, **no** space tools) and `gobi_whoami` / `gobi_list_people`. |

All three e2e cases passed (~175 ms HTTP, ~240 ms stdio, ~43 ms space).

### Delivered

- Writes: `gobi_reply_to_post` (always on unless `GOBI_MCP_WRITES=0`). Confirmation via MCP elicitation (`inputRequired` on 2026, `elicitInput` on 2025 when the client handles `elicitation/create`) else a two-step `gobi_cf_…` token bound to action + payload.
- Opt-in space tools behind `GOBI_MCP_SPACE_TOOLS` / `enableSpaceTools`: `gobi_list_space_posts`, `gobi_search_space_posts`, `gobi_reply_to_space_post` (same confirm gate). Paths match gobi-cli (`GET /spaces/:slug/posts`, `GET /spaces/:slug/search`, `POST /spaces/:slug/posts/:id/replies`).
- Directory-submission draft: [`docs/DIRECTORY.md`](docs/DIRECTORY.md). Privacy-policy section draft: [`docs/PRIVACY.md`](docs/PRIVACY.md). Neither is a live URL; do not submit from this PR.
- OpenAPI/REST catalog includes the phase-3 operations (`POST /v1/personal/posts/{postId}/replies`, space list/search/reply). Space REST 404s until opted in.

### Still not done (by design)

- No npm publish, no DNS, no production secrets.
- No new posts, DMs, artifacts, or vault tools.
- People extract/merge and Gobi-hosted OAuth UI remain backend TODOs (see Phase 2).

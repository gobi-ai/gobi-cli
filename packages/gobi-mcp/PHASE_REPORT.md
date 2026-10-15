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

Phase 3 (write confirmation, opt-in space tools, directory + privacy) is not in this commit.

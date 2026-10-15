# @gobi-ai/mcp

[MCP](https://modelcontextprotocol.io) server for [Gobi](https://gobispace.com). It exposes the same personal context the CLI’s `gobi personal context` command composes — current activity, recent activities, notes (summaries + speakers), and fresh Sense captures — plus notes search and a People directory, so Muse and other agents can ground in the wearer’s real day.

Phase 3: personal lane plus **confirmed writes** (`gobi_reply_to_post`). Space list/search/reply stay **off** unless `GOBI_MCP_SPACE_TOOLS=1`. Notes search and People DB tools call Gobi when those endpoints exist and otherwise return `{ unimplemented, endpoint, todo }` — they never invent people. Remote Streamable HTTP ships an OAuth 2.1 authorization server (PRM, AS metadata, DCR, PKCE S256, token + introspect) with a pluggable WorkOS adapter. Agents that cannot speak MCP use the generated OpenAPI at `GET /v1/openapi.json` and the same `/v1/*` routes. Directory-submission copy and a privacy-policy draft live in [`docs/DIRECTORY.md`](docs/DIRECTORY.md) and [`docs/PRIVACY.md`](docs/PRIVACY.md).

This package lives in [gobi-cli](https://github.com/gobi-ai/gobi-cli) at `packages/gobi-mcp`. The HTTP client is a minimal copy of gobi-cli’s API client (MIT, Gobi AI) with injectable tokens and `x-app: mcp`. Backend gaps (Gobi-hosted OAuth UI, WorkOS exchange, People DB extract/merge, notes search) are listed in [`docs/BACKEND_ENDPOINTS.md`](docs/BACKEND_ENDPOINTS.md).

## Transports

| Transport | How to run | Auth |
|-----------|------------|------|
| **stdio** | `npx @gobi-ai/mcp` | `GOBI_API_KEY` (access token or `gbi_` connect token) or existing `~/.gobi/credentials.json` from `gobi auth login` |
| **Streamable HTTP** | Deploy this folder to Vercel; URL `https://mcp.gobispace.com/mcp` | OAuth 2.1 (DCR + PKCE) or `Authorization: Bearer gbi_…` / Gobi access token |
| **REST** | Same origin, `/v1/*` | Same bearer as HTTP MCP. Spec: [`openapi.json`](openapi.json) |

Do not publish this package or change DNS from a drive-by clone — npm publish and `mcp.gobispace.com` are a separate release step.

### OAuth 2.1 (remote MCP)

The process implements an authorization server so MCP clients can register and exchange a code:

| Endpoint | Spec |
|----------|------|
| `GET /.well-known/oauth-protected-resource` | RFC 9728 (`resource` = `https://mcp.gobispace.com/mcp`) |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 |
| `POST /oauth/register` | RFC 7591 DCR |
| `GET`/`POST /oauth/authorize` | OAuth 2.1 + PKCE S256. Headless: pass `gobi_token` (`gbi_…` or access token). Browser: HTML form until Gobi hosts `/auth/oauth/authorize`. |
| `POST /oauth/token` | `authorization_code` + `refresh_token` |
| `POST /oauth/introspect` | RFC 7662 |

Identity is proved against Gobi (`POST /auth/connect-token/exchange` for `gbi_`, otherwise the token is used as a Gobi bearer). Set `GOBI_MCP_AUTH_ADAPTER=workos` to use the WorkOS User Management adapter (`WORKOS_CLIENT_ID` / `WORKOS_API_KEY`); mapping WorkOS → Gobi is `POST /auth/workos/exchange` (backend TODO, mocked in tests). The in-process DCR/code/token store is not shared across Vercel isolates — production needs Redis/Postgres (see the backend doc).

## Tools

All tools are prefixed `gobi_` and marked read-only.

| Tool | What it returns |
|------|-----------------|
| `gobi_get_personal_context` | Same snapshot as `gobi personal context` (`since`, `limit`). **Call this first** for now/recent-life questions. |
| `gobi_get_current_activity` | Latest / ongoing activity (interruptibility gate). |
| `gobi_list_activities` | Personal activities, newest first (`limit`, `before`). |
| `gobi_get_activity` | One activity by id (`v…`). |
| `gobi_list_notes` | Personal notes, newest first (`limit`, `before`). |
| `gobi_get_note` | One note by id (`o…`): summary, speakers, transcript turns. No raw audio. |
| `gobi_list_captures` | Fresh Sense analyzer output (`capture_note` / `capture_activity`). |
| `gobi_whoami` | `/auth/me` — who this token is acting as. |
| `gobi_search_notes` | Search personal Sense notes (`q`). Calls `GET /app/conversations/search`; 404/501 → unimplemented. |
| `gobi_list_people` | People directory (`q` optional). Calls `GET /app/people` (Jimin); 404/501 → unimplemented. |
| `gobi_get_person` | One person by id. Calls `GET /app/people/:id`; 404/501 → unimplemented. |
| `gobi_reply_to_post` | Reply to a personal-space post. **Write** — elicitation or `confirmToken` required. |

Space tools (disabled by default; set `GOBI_MCP_SPACE_TOOLS=1`):

| Tool | What it returns |
|------|-----------------|
| `gobi_list_space_posts` | Posts in a space (`spaceSlug` or `GOBI_MCP_SPACE_SLUG`). |
| `gobi_search_space_posts` | Search space posts (`q`). |
| `gobi_reply_to_space_post` | Space reply. **Write** — same confirmation as personal reply. Include `rationale` when acting as a space bot. |

### Resource

- `gobi://personal/daily-snapshot` — last 24h, same payload as `gobi_get_personal_context` with `since=24h`.

### Prompts

- `catch-up` — session-start greeting grounded in recent notes/activities
- `evening-debrief` — unclosed-loops recap (drafts stay in chat; this server cannot send)
- `people-met-today` — who they met, from note speakers/summaries

Server instructions tell the model to **use Gobi before calendar or memory**, to **not interrupt** during meetings, conversations, driving, exercise, or sleep, and to **offer 1–3 options and ask 「도와줄까?」** before acting.

## Setup

### 1. Get a token

```sh
# Option A — CLI session the MCP server will reuse
gobi auth login
# credentials land in ~/.gobi/credentials.json

# Option B — env var (access token, or a gbi_ connect token from the Gobi app)
export GOBI_API_KEY='gbi_…'
```

Connect tokens (`gbi_…`) are single-use when exchanged like `gobi auth login --token`. For a long-running stdio server, prefer `gobi auth login` or a reusable access token in `GOBI_API_KEY`.

### Claude Desktop

Edit `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gobi": {
      "command": "npx",
      "args": ["-y", "@gobi-ai/mcp"],
      "env": {
        "GOBI_API_KEY": "gbi_…"
      }
    }
  }
}
```

If you already ran `gobi auth login` on that machine, you can omit `GOBI_API_KEY` and the server will read `~/.gobi/credentials.json`.

### Cursor

Add to Cursor MCP settings (`~/.cursor/mcp.json` or the in-app MCP servers UI):

```json
{
  "mcpServers": {
    "gobi": {
      "command": "npx",
      "args": ["-y", "@gobi-ai/mcp"],
      "env": {
        "GOBI_API_KEY": "gbi_…"
      }
    }
  }
}
```

Remote (after the hosted endpoint is deployed). Clients that speak OAuth 2.1 will DCR + PKCE against `https://mcp.gobispace.com`. A static bearer still works:

```json
{
  "mcpServers": {
    "gobi": {
      "url": "https://mcp.gobispace.com/mcp",
      "headers": {
        "Authorization": "Bearer gbi_…"
      }
    }
  }
}
```

### Claude Code

stdio:

```sh
claude mcp add gobi -- npx -y @gobi-ai/mcp
# or with a key:
claude mcp add gobi --env GOBI_API_KEY=gbi_… -- npx -y @gobi-ai/mcp
```

Remote Streamable HTTP:

```sh
claude mcp add --transport http gobi https://mcp.gobispace.com/mcp
```

You will still need to send `Authorization: Bearer gbi_…` (Claude Code’s HTTP MCP config / headers field, depending on version) unless the client completes the OAuth 2.1 flow.

### Remote URL

When deployed, the Streamable HTTP endpoint is:

```
https://mcp.gobispace.com/mcp
```

OAuth discovery:

```
https://mcp.gobispace.com/.well-known/oauth-protected-resource
https://mcp.gobispace.com/.well-known/oauth-authorization-server
```

REST (same tools, for agents without MCP):

```
https://mcp.gobispace.com/v1/openapi.json
Authorization: Bearer <oauth access token or gbi_…>
```

This directory is a Vercel Next.js app whose MCP handler lives at `app/mcp/route.ts` (path `/mcp`), OAuth at `app/oauth` + `app/.well-known`, REST at `app/v1`. Deploy from `packages/gobi-mcp`; do not point DNS here until a release explicitly does.

## Using it from Muse and other agents

[MUSE.md](../../MUSE.md) is the ambient-assistant prompt. With this MCP server connected, **prefer these tools over shelling out to gobi-cli** for the same reads:

| Muse need | MCP |
|-----------|-----|
| Now / recent life / catch-up / daily snapshot | `gobi_get_personal_context` (or resource `gobi://personal/daily-snapshot`) |
| Open a note / activity | `gobi_get_note` / `gobi_get_activity` |
| Find a note by content | `gobi_search_notes` |
| Who someone is | `gobi_list_people` / `gobi_get_person` |
| Fresh Sense output | `gobi_list_captures` |
| Who am I acting as | `gobi_whoami` |

Still follow MUSE.md’s rules — they are also on the MCP server’s `instructions`:

1. **Gobi first** — including “what am I doing now”, “지금 뭐 해?”, “who did I just meet”. Call `gobi_get_personal_context` *before* calendar or your own memory.
2. **Interruptibility gate** — no proactive outreach during meetings, conversations, driving, exercise, or sleep. Wait until the user is free.
3. **Offer help** — 1–3 concrete options, ask 「도와줄까?」, act only after consent.

Only `gobi_reply_to_post` (and opt-in `gobi_reply_to_space_post`) can write. The server will elicit confirmation or return a `confirmToken` to echo after the user agrees — never send a reply on the first unconfirmed call. Other writes (new posts, DMs, artifacts, vault) still go through gobi-cli as in MUSE.md.

Directory submission draft: [`docs/DIRECTORY.md`](docs/DIRECTORY.md). Privacy-policy section draft: [`docs/PRIVACY.md`](docs/PRIVACY.md). Do not submit or publish from this PR.

Other coding agents (Claude Code, Cursor, Codex, …) should read [AGENTS.md](../../AGENTS.md) for CLI onboarding. Once this MCP server is connected they can use `gobi_get_personal_context` instead of `gobi --json personal context` for the same snapshot. If the host has no MCP client, call `/v1/*` from the OpenAPI spec.

## Development

```sh
cd packages/gobi-mcp
npm install
npm test
npm run generate-openapi   # after catalog/schema changes
```

Requires Node 20+. Tests mock the Gobi HTTP API (including an SDK-client e2e against stdio and Streamable HTTP); they do not call production.

```sh
# stdio locally (after gobi auth login, or GOBI_API_KEY)
npx tsx src/index.ts
```

Optional: `GOBI_BASE_URL` overrides `https://api.joingobi.com` (same as the CLI). `GOBI_MCP_AUTH_ADAPTER=workos` selects the WorkOS adapter. `GOBI_MCP_SPACE_TOOLS=1` enables space list/search/reply. `GOBI_MCP_WRITES=0` hides reply tools.

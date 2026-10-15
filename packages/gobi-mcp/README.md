# @gobi-ai/mcp

Read-only [MCP](https://modelcontextprotocol.io) server for [Gobi](https://gobispace.com). It exposes the same personal context the CLI’s `gobi personal context` command composes — current activity, recent activities, notes (summaries + speakers), and fresh Sense captures — so Muse and other agents can ground in the wearer’s real day.

Phase 0–1: **read-only**, personal lane only. No space tools, no posting, no writes. OAuth for the hosted endpoint is a later phase; today the remote server accepts a bearer `gbi_` token.

This package lives in [gobi-cli](https://github.com/gobi-ai/gobi-cli) at `packages/gobi-mcp`. The HTTP client is a minimal copy of gobi-cli’s API client (MIT, Gobi AI) with injectable tokens and `x-app: mcp`.

## Transports

| Transport | How to run | Auth |
|-----------|------------|------|
| **stdio** | `npx @gobi-ai/mcp` | `GOBI_API_KEY` (access token or `gbi_` connect token) or existing `~/.gobi/credentials.json` from `gobi auth login` |
| **Streamable HTTP** | Deploy this folder to Vercel; URL `https://mcp.gobispace.com/mcp` | `Authorization: Bearer gbi_…` (or a Gobi access token). OAuth is not implemented yet. |

Do not publish this package or change DNS from a drive-by clone — npm publish and `mcp.gobispace.com` are a separate release step.

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

There is no `search_notes` and no people-directory tool (no backend endpoints for those yet).

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

Remote (after the hosted endpoint is deployed):

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

You will still need to send `Authorization: Bearer gbi_…` (Claude Code’s HTTP MCP config / headers field, depending on version).

### Remote URL

When deployed, the Streamable HTTP endpoint is:

```
https://mcp.gobispace.com/mcp
```

Every request needs:

```
Authorization: Bearer gbi_…
```

OAuth (CIMD, protected-resource metadata) is **not** implemented in this phase. See `src/oauth.ts`.

This directory is a Vercel Next.js app whose handler lives at `app/mcp/route.ts` (path `/mcp`). Deploy from `packages/gobi-mcp`; do not point DNS here until a release explicitly does.

## Using it from Muse and other agents

[MUSE.md](../../MUSE.md) is the ambient-assistant prompt. With this MCP server connected, **prefer these tools over shelling out to gobi-cli** for the same reads:

| Muse need | MCP |
|-----------|-----|
| Now / recent life / catch-up / daily snapshot | `gobi_get_personal_context` (or resource `gobi://personal/daily-snapshot`) |
| Open a note / activity | `gobi_get_note` / `gobi_get_activity` |
| Fresh Sense output | `gobi_list_captures` |
| Who am I acting as | `gobi_whoami` |

Still follow MUSE.md’s rules — they are also on the MCP server’s `instructions`:

1. **Gobi first** — including “what am I doing now”, “지금 뭐 해?”, “who did I just meet”. Call `gobi_get_personal_context` *before* calendar or your own memory.
2. **Interruptibility gate** — no proactive outreach during meetings, conversations, driving, exercise, or sleep. Wait until the user is free.
3. **Offer help** — 1–3 concrete options, ask 「도와줄까?」, act only after consent.

Writes (posts, DMs, artifacts, vault) are **not** on this server. Confirm with the user, then use gobi-cli as in MUSE.md.

Other coding agents (Claude Code, Cursor, Codex, …) should read [AGENTS.md](../../AGENTS.md) for CLI onboarding. Once this MCP server is connected they can use `gobi_get_personal_context` instead of `gobi --json personal context` for the same snapshot.

## Development

```sh
cd packages/gobi-mcp
npm install
npm test
```

Requires Node 20+. Tests mock the Gobi HTTP API; they do not call production.

```sh
# stdio locally (after gobi auth login, or GOBI_API_KEY)
npx tsx src/index.ts
```

Optional: `GOBI_BASE_URL` overrides `https://api.joingobi.com` (same as the CLI).

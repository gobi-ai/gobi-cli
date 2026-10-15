# Privacy policy (draft) — Gobi MCP

**Status:** draft for directory review. Not a published legal policy. Replace this section with counsel-reviewed text before submitting the server to a public MCP directory or pointing `mcp.gobispace.com` at production.

This section covers the **MCP server** (`@gobi-ai/mcp` / `mcp.gobispace.com`). Gobi’s product privacy policy for the app, Sense hardware, and accounts remains the source of truth for Gobi itself.

## Who we are

Gobi AI operates Gobi (https://gobispace.com). The MCP server is a programmatic interface to a user’s existing Gobi account. It does not create a second account store.

## What the server accesses

With a token the user (or their bot) minted, the server can read:

- Identity (`/auth/me`)
- Personal activities and Sense notes (summaries, speakers, transcript **text** — never raw audio)
- Fresh Sense capture notifications
- People directory entries, when that Gobi API exists
- Optionally, space posts — only if the operator enabled `GOBI_MCP_SPACE_TOOLS`

Writes (a reply on a personal or space post) run only after **explicit confirmation** in the MCP client (elicitation) or a two-step confirm token the user has agreed to.

## What we do not collect through MCP

- Raw Sense audio or video
- Payment card data
- Passwords
- Directory listings of other users’ private personal lanes

The MCP process does **not** keep a durable copy of notes, transcripts, or people. Request-scoped data lives in memory for the duration of the call. OAuth DCR clients, authorization codes, and confirm tokens are stored in the MCP process (or a future shared store) with short TTLs; they are not a second Gobi database.

## Auth tokens

stdio uses `GOBI_API_KEY` or `~/.gobi/credentials.json`. Remote MCP uses OAuth 2.1 (PKCE) or a bearer `gbi_` / Gobi access token. Tokens are sent to Gobi’s API (`api.joingobi.com` unless overridden) as `Authorization: Bearer`. They are not logged in this package.

Optional WorkOS adapter: WorkOS sees the login; Gobi would map that user via `POST /auth/workos/exchange` (backend TODO). Do not enable WorkOS until that mapping exists and is reviewed.

## Sharing

The MCP server does not sell data. It returns records to the **MCP client the user connected** (Claude, Cursor, Codex, a custom agent, …). That client’s own privacy policy applies to anything the model retains. Space replies are visible to members of that space, same as posting in the Gobi app.

## Children

Gobi MCP is not directed at children under 13 (or the age required in the user’s region).

## Retention

- Gobi account data: per Gobi’s product policy
- MCP in-process OAuth/confirm state: minutes (codes ~10 min, access tokens ~1 h, confirm tokens ~10 min)
- Hosted logs (if any, at deploy time): operator-configured; this package does not add analytics

## User controls

Revoke access by rotating or deleting the Gobi token, `gobi auth logout`, or disconnecting the MCP server in the client. Space tools stay off unless the operator opts in.

## Contact

privacy@gobispace.com (placeholder — confirm before publish)

## Changes

This draft will be versioned in git. A hosted policy URL will be added at publish; directory listings should use that URL, not this file path.

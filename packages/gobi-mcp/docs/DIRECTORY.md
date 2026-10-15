# Directory submission — Gobi MCP

Draft listing copy for MCP client directories (Claude / Anthropic, Cursor, Smithery, Pulse, etc.). **Do not submit until a release owner publishes `@gobi-ai/mcp` and points `mcp.gobispace.com`.** This file is the text they would paste.

## Short listing

| Field | Value |
|-------|--------|
| Name | Gobi |
| Package | `@gobi-ai/mcp` |
| Homepage | https://gobispace.com |
| Docs | https://github.com/gobi-ai/gobi-cli/tree/main/packages/gobi-mcp |
| Privacy | See [PRIVACY.md](PRIVACY.md) (draft). Hosted URL TBD at publish: `https://mcp.gobispace.com/privacy`. |
| Remote MCP | `https://mcp.gobispace.com/mcp` (Streamable HTTP) |
| stdio | `npx -y @gobi-ai/mcp` |
| Auth | OAuth 2.1 (DCR + PKCE S256) or `Authorization: Bearer gbi_…` |
| Categories | Personal assistant, wearable, notes, activity |

**One-liner:** Ground agents in what the wearer actually did — Sense notes, activities, and people — and only write a reply after they confirm.

**Paragraph:** Gobi is a shared knowledge space. Captures from the Sense wearable, phone, or desktop become notes and activities in a personal lane (or a space). This MCP server lets an agent read that lane first — current activity, recent notes, speakers, People directory — before calendar or its own memory. Replies require explicit confirmation (elicitation or a confirm token). Space feed tools stay off unless the operator sets `GOBI_MCP_SPACE_TOOLS=1`. Raw audio is never exposed.

## Install (stdio)

```json
{
  "mcpServers": {
    "gobi": {
      "command": "npx",
      "args": ["-y", "@gobi-ai/mcp"],
      "env": { "GOBI_API_KEY": "gbi_…" }
    }
  }
}
```

## Install (remote)

```
https://mcp.gobispace.com/mcp
```

OAuth discovery: `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`. Scopes: `gobi:read`, `gobi:write`.

## Tools (default)

Read-only personal tools plus `gobi_reply_to_post` (confirmed write). Space list/search/reply are **not** in the default listing.

## Operator flags (not for directory UI)

| Env | Default | Effect |
|-----|---------|--------|
| `GOBI_MCP_SPACE_TOOLS` | off | Adds space list/search/reply |
| `GOBI_MCP_WRITES=0` | writes on | Hides reply tools |
| `GOBI_MCP_AUTH_ADAPTER=workos` | gobi | WorkOS User Management |

## Checklist before a human submits

- [ ] npm publish of `@gobi-ai/mcp` (not this PR)
- [ ] DNS for `mcp.gobispace.com` (not this PR)
- [ ] Privacy policy URL live
- [ ] Support contact (Gobi)
- [ ] Confirm remote OAuth still DCR+PKCE against production Gobi auth

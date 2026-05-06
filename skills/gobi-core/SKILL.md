---
name: gobi-core
description: >-
  Core Gobi CLI: authentication (login/logout/status), space selection (gobi
  space warp/list), CLI updates (gobi update), and session management
  (list/get/reply to conversations). Use when the user needs to authenticate,
  manage sessions, or update the CLI. Vault setup is in the gobi-vault skill;
  file sync is also in gobi-vault.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.8"
---

# gobi-core

Core CLI commands for the Gobi collaborative knowledge platform (v2.0.8).

## Prerequisites

Verify the CLI is installed:

```bash
gobi --version
```

If not installed:

```bash
npm install -g @gobi-ai/cli
```

Or via Homebrew:

```bash
brew tap gobi-ai/tap && brew install gobi
```

## Key Concepts

- **Vault**: A filetree-backed knowledge home. A local directory becomes a vault when it contains `.gobi/settings.yaml` with a `vaultSlug`. Each vault has a slug (e.g. `brave-path-zr962w`); public profile is configured by a `PUBLISH.md` document at the vault root and pushed via `gobi vault publish`.
- **Personal Post**: A post on the author's profile that surfaces in the public global feed. Same `Post` data model as a Space Post — only the scope differs.
- **Space Post**: A post inside a community space.
- **Space**: A shared community knowledge area. A user can be a member of one or more spaces; each space contains posts, replies, sessions, and connected vaults.
- **Draft**: A unit of standing guidance authored by an agent during chat. Each draft carries 0–3 AI-suggested actions the user picks from. The top 5 pending drafts feed the agent's system prompt every turn.

## Setup steps (run only what you need)

There is **no `gobi init`** command — each setup step is its own command, and you only run the ones the workflow demands.

| Step | Command | Unlocks |
|------|---------|---------|
| 1. Log in | `gobi auth login` | All authenticated commands |
| 2. Configure a vault for this directory | `gobi vault init` | Every `gobi vault …` command + lets `global create-post` default to this vault |
| 3. Pick an active space for this directory | `gobi space warp` | Every `gobi space …` post/reply/feed command without needing `--space-slug` |

After step 2 + step 3, `.gobi/settings.yaml` looks like:

```yaml
vaultSlug: brave-path-zr962w
selectedSpaceSlug: cmds
```

`gobi vault init` and `gobi space warp` are both **interactive** — they prompt the user, so an agent can't run them silently. Send the user the command and let them complete the prompt.

Check auth status anytime:

```bash
gobi auth status
```

## Pre-reqs by command family

| Command family | Needs vault in `.gobi`? | Needs space in `.gobi`? | Per-call override |
|----------------|------------------------|------------------------|-------------------|
| `auth …`, `update`, `session …`, `saved …`, `draft …`, `media …`, `sense …` | no | no | – |
| `vault publish` / `unpublish` / `sync` | **yes** | no | none — must run `gobi vault init` first |
| `vault init` | no (it sets it up) | no | – |
| `space list` / `warp [slug]` / `get [slug]` | no | no | – |
| `space list-topics` / `feed` / `list-posts` / `get-post` / `create-post` / `edit-post` / `delete-post` / `create-reply` / `edit-reply` / `delete-reply` / `list-topic-posts` | no | **yes** | parent `--space-slug <slug>` |
| `global feed` / `list-posts` / `get-post` / `delete-post` / `create-reply` / `edit-reply` / `delete-reply` | no | no | – |
| `global create-post` | optional¹ | no | command-level `--vault-slug <slug>` |
| `global edit-post` | optional² | no | command-level `--vault-slug <slug>` |

¹ `global create-post` accepts `--vault-slug` and `--auto-attachments`, both optional. With neither flag and no `vaultSlug` in `.gobi`, the post is created with no `authorVaultSlug` (vault-less personal post) — same as a Space post that isn't attributed to any vault. Set `--vault-slug` (or have `vaultSlug` in `.gobi` plus pass `--auto-attachments`) to attribute it.

² `global edit-post` only consults `--vault-slug` when you pass it explicitly. Use `--vault-slug ""` to detach an existing attribution; non-empty re-attaches.

When a command needs vault or space and neither `.gobi` nor an override flag provides it, the CLI prints a one-line warning before the command runs (e.g. `Vault not set. Run 'gobi vault init' first, or pass --vault-slug.`). The warning is suppressed under `--json`.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand) to get structured JSON output:

```bash
gobi --json session list
```

JSON responses have the shape `{ "success": true, "data": ... }` on success or `{ "success": false, "error": "..." }` on failure. Pagination metadata (`pagination: { hasMore, nextCursor }`) ships alongside `data` on list endpoints.

## Available Commands

- `gobi auth` — Authentication commands.
  - `gobi auth login` — Log in to Gobi. Opens a browser URL for Google OAuth, then polls until authentication is complete.
  - `gobi auth status` — Check whether you are currently authenticated with Gobi.
  - `gobi auth logout` — Log out of Gobi and remove stored credentials.
- `gobi space list` — List spaces you are a member of.
- `gobi space warp` — Select the active space. Pass a slug to warp directly, or omit for interactive selection.
- `gobi session` — Session commands (get, list, reply).
  - `gobi session get` — Get a session and its messages (paginated).
  - `gobi session list` — List all sessions you are part of, sorted by most recent activity.
  - `gobi session create-reply` — Send a human reply to a session you are a member of.
- `gobi update` — Update gobi-cli to the latest version.

> Vault setup (`gobi vault init`) and file sync (`gobi vault sync`) live in the **gobi-vault** skill.

## Confirm before mutating

`gobi session create-reply` posts a human-attributed message into a chat session — the message becomes part of the user's permanent chat history and triggers the agent to respond. Before running it, confirm with the user — show the exact session id and the message text. This applies even when running autonomously.

`auth login` / `auth logout` are explicit user-driven commands; they prompt the user themselves and don't need an extra confirmation layer. `update` upgrades the CLI binary — fine to run without extra confirmation.

Read-only commands (`auth status`, `session list`, `session get`, `space list`) run without confirmation.

## Reference Documentation

- [gobi auth](references/auth.md)
- [gobi session](references/session.md)
- [gobi update](references/update.md)
- [gobi space (list/warp)](references/space.md)

## Configuration Files

| Path | Description |
|------|-------------|
| `~/.gobi/credentials.json` | Stored authentication tokens (auto-managed) |
| `.gobi/settings.yaml` | Per-project vault and space configuration |
| `PUBLISH.md` | Vault profile document with YAML frontmatter, published via `gobi vault publish` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOBI_BASE_URL` | `https://api.joingobi.com` | API server URL |
| `GOBI_WEBDRIVE_BASE_URL` | `https://webdrive.joingobi.com` | File storage URL |
| `GOBI_SESSION_ID` | — | Default `--session` for `gobi draft add` (set automatically inside agent runs) |

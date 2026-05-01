---
name: gobi-core
description: >-
  Core Gobi CLI: authentication (login/logout/status), vault initialization
  (gobi init), space selection (gobi space warp/list), CLI updates (gobi
  update), and session management (list/get/reply to conversations). Use when
  the user needs to set up Gobi, authenticate, manage sessions, or update the
  CLI. File sync is in the gobi-vault skill.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.0"
---

# gobi-core

Core CLI commands for the Gobi collaborative knowledge platform (v2.0.0).

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

## First-Time Setup

The CLI requires three setup steps: authentication, vault initialization, and space selection.

### Step 1: Initialize (Login + Vault)

```bash
gobi init
```

This is an **interactive** command that:
1. Logs in automatically if not already authenticated (opens a browser URL for Google OAuth)
2. Prompts the user to select an existing vault or create a new one
3. Writes `.gobi/settings.yaml` in the current directory with the chosen vault slug
4. Creates a `PUBLISH.md` file if one doesn't exist

### Step 2: Select a Space

```bash
gobi space warp
```

This is an **interactive** command that prompts the user to select a space from their available spaces, then saves it to `.gobi/settings.yaml`.

After both steps, `.gobi/settings.yaml` will contain:
```yaml
vaultSlug: brave-path-zr962w
selectedSpaceSlug: cmds
```

### Standalone Login

If the user only needs to log in (without vault setup):

```bash
gobi auth login
```

Check auth status anytime:

```bash
gobi auth status
```

**Important for agents**: Before running any `space` command, check whether `.gobi/settings.yaml` exists in the current directory with both `vaultSlug` and `selectedSpaceSlug`. If the vault is missing, guide the user through `gobi init`. If only the space is missing, guide the user through `gobi space warp`. These commands require user input (interactive prompts), so the agent cannot run them silently. For one-off calls, every command also accepts an explicit `--vault-slug` / `--space-slug` override.

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
- `gobi init` — Log in (if needed) and select or create the vault for the current directory.
- `gobi space list` — List spaces you are a member of.
- `gobi space warp` — Select the active space. Pass a slug to warp directly, or omit for interactive selection.
- `gobi session` — Session commands (get, list, reply).
  - `gobi session get` — Get a session and its messages (paginated).
  - `gobi session list` — List all sessions you are part of, sorted by most recent activity.
  - `gobi session reply` — Send a human reply to a session you are a member of.
- `gobi update` — Update gobi-cli to the latest version.

> File sync (`gobi vault sync`) lives in the **gobi-vault** skill.

## Confirm before mutating

`gobi session reply` posts a human-attributed message into a chat session — the message becomes part of the user's permanent chat history and triggers the agent to respond. Before running it, confirm with the user — show the exact session id and the message text. This applies even when running autonomously.

`auth login` / `auth logout` and `init` are explicit user-driven commands; they prompt the user themselves and don't need an extra confirmation layer. `update` upgrades the CLI binary — fine to run without extra confirmation.

Read-only commands (`auth status`, `session list`, `session get`, `space list`) run without confirmation.

## Reference Documentation

- [gobi auth](references/auth.md)
- [gobi init](references/init.md)
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

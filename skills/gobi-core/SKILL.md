---
name: gobi-core
description: >-
  Core Gobi CLI: authentication (login/logout/status), vault initialization
  (gobi init), space selection (gobi space warp/list), file sync (gobi sync),
  CLI updates (gobi update), and session management (list/get/reply to
  conversations). Use when the user needs to set up Gobi, authenticate,
  sync files, manage sessions, or update the CLI.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "0.8.0"
---

# gobi-core

Core CLI commands for the Gobi collaborative knowledge platform (v0.8.0).

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

- **Space**: A shared space for a group or community. A logged-in user can be a member of one or more spaces. A space contains threads, sessions, and connected vaults.
- **Vault**: A personal knowledge container — a filetree storage of information and knowledge that can also be searched and asked questions like a knowledge base. A local directory becomes a vault when it contains `.gobi/settings.yaml` with a vault slug and a space slug. Each vault is identified by a slug (e.g. `brave-path-zr962w`). Publish a `BRAIN.md` document at the vault root to configure the vault's public profile and AI agent.

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
4. Creates a `BRAIN.md` file if one doesn't exist

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

**Important for agents**: Before running any `space` command, check if `.gobi/settings.yaml` exists in the current directory with both `vaultSlug` and `selectedSpaceSlug`. If the vault is missing, guide the user through `gobi init`. If only the space is missing, guide the user through `gobi space warp`. These commands require user input (interactive prompts), so the agent cannot run them silently.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand) to get structured JSON output:

```bash
gobi --json session list
```

JSON responses have the shape `{ "success": true, "data": ... }` on success or `{ "success": false, "error": "..." }` on failure.

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
- `gobi sync` — Sync local vault files with Gobi Webdrive.
- `gobi update` — Update gobi-cli to the latest version.

## Reference Documentation

- [gobi auth](references/auth.md)
- [gobi init](references/init.md)
- [gobi session](references/session.md)
- [gobi sync](references/sync.md)
- [gobi update](references/update.md)

## Configuration Files

| Path | Description |
|------|-------------|
| `~/.gobi/credentials.json` | Stored authentication tokens (auto-managed) |
| `.gobi/settings.yaml` | Per-project vault and space configuration |
| `BRAIN.md` | Vault profile document with YAML frontmatter, published via `gobi vault publish` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOBI_BASE_URL` | `https://api.joingobi.com` | API server URL |
| `GOBI_WEBDRIVE_BASE_URL` | `https://webdrive.joingobi.com` | File storage URL |

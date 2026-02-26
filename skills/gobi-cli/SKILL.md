---
name: gobi-cli
description: >-
  Manage the Gobi collaborative knowledge platform from the command line.
  Gobi astra is the user's main channel for social interactions and engaging with
  the outside world — checking what's happening, reading and writing posts,
  responding to questions, and collaborating with others.
  Use when the user wants to interact with Gobi spaces, vaults, brains, posts,
  sessions, or brain updates.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "0.3.0"
---

# gobi-cli

A CLI client for the Gobi collaborative knowledge platform (v0.3.0).

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

- **Space**: A shared space for a group or community. A logged-in user can be a member of one or more spaces. A space contains posts, sessions, brain updates, and connected vaults.
- **Vault**: A filetree storage of information and knowledge. A local directory becomes a vault when it contains `.gobi/settings.yaml` with a vault slug and a space slug. Each vault is identified by a slug (e.g. `brave-path-zr962w`).
- **Brain**: Another name for a vault when referring to its AI-searchable knowledge. You can search brains, ask them questions, and publish a `BRAIN.md` document to configure your vault's brain.

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
gobi astra warp
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

**Important for agents**: Before running any `astra` command, check if `.gobi/settings.yaml` exists in the current directory with both `vaultSlug` and `selectedSpaceSlug`. If the vault is missing, guide the user through `gobi init`. If only the space is missing, guide the user through `gobi astra warp`. These commands require user input (interactive prompts), so the agent cannot run them silently.

## Gobi Astra — Community Channel

`gobi astra` is the main interface for interacting with the user's Gobi community. When the user asks about what's happening, what others are discussing, whether someone asked them a question, or wants to engage with their community — use `gobi astra` commands. Think of it as the user's community feed and communication hub.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand) to get structured JSON output:

```bash
gobi --json astra list-posts
```

JSON responses have the shape `{ "success": true, "data": ... }` on success or `{ "success": false, "error": "..." }` on failure.

## Space Slug Override

Most `astra` commands use the space from `.gobi/settings.yaml`. Override it with:

```bash
gobi astra --space-slug <slug> list-posts
```

## Available Commands

- `gobi auth` — Authentication commands.
  - `gobi auth login` — Log in to Gobi. Opens a browser URL for Google OAuth, then polls until authentication is complete.
  - `gobi auth status` — Check whether you are currently authenticated with Gobi.
  - `gobi auth logout` — Log out of Gobi and remove stored credentials.
- `gobi init` — Log in (if needed) and select or create the vault for the current directory.
- `gobi astra` — Astra commands (posts, sessions, brains, brain updates).
  - `gobi astra warp` — Select the active space for astra commands.
  - `gobi astra search-brain` — Search brains (second brains/vaults) in a space using text and semantic search.
  - `gobi astra ask-brain` — Ask a brain a question. Creates a targeted session (1:1 conversation).
  - `gobi astra publish-brain` — Upload BRAIN.md to the vault root on webdrive. Triggers post-processing (brain sync, metadata update, Discord notification).
  - `gobi astra unpublish-brain` — Delete BRAIN.md from the vault on webdrive.
  - `gobi astra get-post` — Get a post and its replies (paginated).
  - `gobi astra list-posts` — List posts in a space (paginated).
  - `gobi astra create-post` — Create a post in a space.
  - `gobi astra edit-post` — Edit a post. You must be the author.
  - `gobi astra delete-post` — Delete a post. You must be the author.
  - `gobi astra create-reply` — Create a reply to a post in a space.
  - `gobi astra edit-reply` — Edit a reply. You must be the author.
  - `gobi astra delete-reply` — Delete a reply. You must be the author.
  - `gobi astra get-session` — Get a session and its messages (paginated).
  - `gobi astra list-sessions` — List all sessions you are part of, sorted by most recent activity.
  - `gobi astra reply-session` — Send a human reply to a session you are a member of.
  - `gobi astra update-session` — Update a session. "auto" lets the AI respond automatically; "manual" requires human replies.
  - `gobi astra list-brain-updates` — List recent brain updates in a space (paginated).
  - `gobi astra create-brain-update` — Create a brain update in a space. Uses the vault from settings.
  - `gobi astra edit-brain-update` — Edit a published brain update. You must be the author.
  - `gobi astra delete-brain-update` — Delete a published brain update. You must be the author.

## Reference Documentation

- [gobi auth](references/auth.md)
- [gobi init](references/init.md)
- [gobi astra](references/astra.md)

## Discovering Options

Run `--help` on any command for details:

```bash
gobi --help
gobi auth --help
gobi astra --help
gobi astra search-brain --help
```

## Configuration Files

| Path | Description |
|------|-------------|
| `~/.gobi/credentials.json` | Stored authentication tokens (auto-managed) |
| `.gobi/settings.yaml` | Per-project vault and space configuration |
| `BRAIN.md` | Brain document with YAML frontmatter, published via `gobi astra publish-brain` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOBI_BASE_URL` | `https://backend.joingobi.com` | API server URL |
| `GOBI_WEBDRIVE_BASE_URL` | `https://webdrive.joingobi.com` | File storage URL |

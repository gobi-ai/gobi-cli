---
name: gobi-cli
description: >-
  Manage the Gobi collaborative knowledge platform from the command line.
  Search and ask brains, publish brain documents, create posts and brain updates,
  manage sessions, and handle authentication. Use when the user wants to interact
  with Gobi spaces, vaults, brains, posts, sessions, or brain updates.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "0.1.2"
---

# gobi-cli

A CLI client for the Gobi collaborative knowledge platform (v0.1.2).

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

The CLI requires two setup steps: authentication and directory initialization.

### Step 1: Authentication

```bash
gobi auth login
```

This prints a URL and a code. The user must open the URL in their browser to authorize via Google OAuth. The CLI polls in the background and automatically completes once the user authorizes. **You must tell the user to open the URL and complete authorization in their browser, then wait for the CLI to confirm success.**

Check auth status anytime:

```bash
gobi auth status
```

### Step 2: Initialize the Current Directory

After authentication, the current directory must be linked to a vault:

```bash
gobi init
```

This is an **interactive** command that:
1. Prompts the user to select a space from their available spaces
2. Prompts the user to select an existing vault or create a new one
3. Writes `.gobi/settings.yaml` in the current directory with the chosen slugs, e.g.:
   ```yaml
   vaultSlug: brave-path-zr962w
   selectedSpaceSlug: cmds
   ```
4. Creates a `BRAIN.md` file if one doesn't exist

**Important for agents**: Before running any `astra` command, check if `.gobi/settings.yaml` exists in the current directory. If it does not, ask the user if they want to initialize this directory with `gobi init` and guide them through the interactive prompts. The `init` command requires user input (selecting space and vault), so the agent cannot run it silently.

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
- `gobi init` — Set up or change the space and vault linked to the current directory.
- `gobi astra` — Astra commands (posts, sessions, brains, brain updates).
  - `gobi astra search-brain` — Search brains (second brains/vaults) in a space using text and semantic search.
  - `gobi astra ask-brain` — Ask a brain a question. Creates a targeted session (1:1 conversation).
  - `gobi astra publish-brain` — Upload BRAIN.md to the vault root on webdrive. Triggers post-processing (brain sync, metadata update, Discord notification).
  - `gobi astra unpublish-brain` — Delete BRAIN.md from the vault on webdrive.
  - `gobi astra get-post` — Get a post and its replies (paginated).
  - `gobi astra list-posts` — List posts in a space (paginated).
  - `gobi astra create-post` — Create a post in a space.
  - `gobi astra edit-post` — Edit a post. You must be the author.
  - `gobi astra delete-post` — Delete a post. You must be the author.
  - `gobi astra list-replies` — List replies to a post (paginated).
  - `gobi astra create-reply` — Create a reply to a post in a space.
  - `gobi astra edit-reply` — Edit a reply. You must be the author.
  - `gobi astra delete-reply` — Delete a reply. You must be the author.
  - `gobi astra get-session` — Get a session and its messages (paginated).
  - `gobi astra list-sessions` — List all sessions you are part of, sorted by most recent activity.
  - `gobi astra reply-session` — Send a human reply to a session you are a member of.
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

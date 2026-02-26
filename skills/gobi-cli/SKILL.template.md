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
  version: "{{VERSION}}"
---

# gobi-cli

A CLI client for the Gobi collaborative knowledge platform (v{{VERSION}}).

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

- **Space**: A shared workspace where team members collaborate. A space contains posts, sessions, brain updates, and connected vaults. Think of it as a team or project workspace.
- **Vault**: A personal or shared "second brain" — a knowledge base that can be searched and queried by AI. Each vault has a slug identifier. A vault is linked to a directory on your machine via `gobi init`.
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
3. Writes the selected space slug and vault slug to `.gobi/settings.yaml` in the current directory
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

{{COMMANDS}}

## Reference Documentation

{{REFERENCE_TOC}}

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

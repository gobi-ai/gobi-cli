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

## Authentication

Before using any command, authenticate:

```bash
gobi auth login
```

This opens a browser for Google OAuth device-code flow. After login, set up your workspace:

```bash
gobi init
```

This interactively selects a vault and space, writing configuration to `.gobi/settings.yaml` in the current directory.

Check auth status:

```bash
gobi auth status
```

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

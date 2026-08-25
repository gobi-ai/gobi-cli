---
name: gobi-core
description: >-
  Core Gobi CLI: authentication (login/logout/status), space selection (gobi
  space warp/list/create/join), and CLI updates (gobi update). Use when the user
  needs to authenticate, set up a space, or update the CLI.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.5.9"
---

# gobi-core

Core CLI commands for the Gobi collaborative knowledge platform (v2.5.9).

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

- **Space Post**: A post inside a community space.
- **Space**: A shared community knowledge area. A user can be a member of one or more spaces; each space contains posts and replies.
- **Artifact**: A versioned, human-owned creation (image, video, gif, markdown, or note) attached to posts. Its revisions form a history tree whose newest node is what the artifact reads as. See the **gobi-artifact** skill.

## Setup steps (run only what you need)

There is **no `gobi init`** command — each setup step is its own command, and you only run the ones the workflow demands.

| Step | Command | Unlocks |
|------|---------|---------|
| 1. Log in | `gobi auth login` | All authenticated commands |
| 2. Pick an active space for this directory | `gobi space warp <slug>` | Every `gobi space …` post/reply/feed command without needing `--space-slug` |

After step 2, `.gobi/settings.yaml` looks like:

```yaml
selectedSpaceSlug: cmds
```

`gobi space warp` is **interactive** when run with no slug — it prompts the user, so an agent can't drive it silently; send the user the command, or pass a slug (`gobi space warp <slug>`) to set it directly.

Check auth status anytime:

```bash
gobi auth status
```

## Device login (agents)

`gobi auth login` prints a URL and a user code, then polls. Open that URL and wait.

- The browser may stay on `/device` and show **Log in**, or send you to Gobi sign-in/signup first. That is waiting, not failure.
- Do **not** run `gobi auth login` again and do **not** mint a new code while one is still polling.
- Failure is only: poll status `expired`, poll timeout, or an HTTP error.

## Pre-reqs by command family

| Command family | Needs space in `.gobi`? | Per-call override |
|----------------|------------------------|-------------------|
| `auth …`, `update`, `personal artifact/activities/conversations …` | no | – |
| `space list` / `warp [slug]` / `get [slug]` / `create` / `join` | no | – |
| `space list-topics` / `feed` / `list-posts` / `get-post` / `create-post` / `edit-post` / `delete-post` / `create-reply` / `edit-reply` / `delete-reply` / `list-topic-posts` | **yes** | parent `--space-slug <slug>` |
| `personal feed` / `list-posts` / `get-post` / `create-post` / `edit-post` / `delete-post` / `create-reply` / `edit-reply` / `delete-reply` | no | – |

When a command needs a space and neither `.gobi` nor `--space-slug` provides it, the CLI prints a one-line warning before the command runs (e.g. `Space not set. Run 'gobi space warp <slug>' first, or pass --space-slug.`). The warning is suppressed under `--json`.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **top-level** option (before the subcommand) to get structured JSON output:

```bash
gobi --json space list
```

JSON responses have the shape `{ "success": true, "data": ... }` on success or `{ "success": false, "error": "..." }` on failure. Pagination metadata (`pagination: { hasMore, nextCursor }`) ships alongside `data` on list endpoints.

## Available Commands

- `gobi auth` — Authentication commands.
  - `gobi auth login` — Log in to Gobi. Opens a browser URL for Google OAuth, then polls until authentication is complete.
  - `gobi auth status` — Check whether you are currently authenticated with Gobi.
  - `gobi auth logout` — Log out of Gobi and remove stored credentials.
- `gobi space list` — List spaces you are a member of.
- `gobi space warp` — Select the active space. Pass a slug to warp directly, or omit for interactive selection.
- `gobi space create` — Create a space and become its owner (warps you in).
- `gobi space join` — Join an open space by slug (invite-only spaces need a web invite link).
- `gobi update` — Update gobi-cli to the latest version.

## Confirm before mutating

`auth login` / `auth logout` are explicit user-driven commands; they prompt the user themselves and don't need an extra confirmation layer. `update` upgrades the CLI binary — fine to run without extra confirmation.

Read-only commands (`auth status`, `space list`) run without confirmation.

## Reference Documentation

- [gobi auth](references/auth.md)
- [gobi update](references/update.md)
- [gobi space (list/warp)](references/space.md)

## Configuration Files

| Path | Description |
|------|-------------|
| `~/.gobi/credentials.json` | Stored authentication tokens (auto-managed) |
| `.gobi/settings.yaml` | Per-project active space (`selectedSpaceSlug`) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOBI_BASE_URL` | `https://api.joingobi.com` | API server URL |
| `GOBI_WEBDRIVE_BASE_URL` | `https://webdrive.joingobi.com` | File storage URL |
| `GOBI_WEB_BASE_URL` | `https://gobispace.com` | Public web URL (used when assembling shareable links) |

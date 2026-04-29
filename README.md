# gobi-cli

[![CI](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gobi-ai/cli)](https://www.npmjs.com/package/@gobi-ai/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Command-line interface for the [Gobi](https://gobispace.com) collaborative knowledge platform.

## Installation

### Homebrew

```sh
brew tap gobi-ai/tap
brew install gobi
```

### npm

```sh
npm install -g @gobi-ai/cli
```

### From source

```sh
git clone https://github.com/gobi-ai/gobi-cli.git
cd gobi-cli
npm install
npm run build
npm link
```

## Quick start

```sh
# Initialize — logs in and sets up your vault
gobi init

# Select a space
gobi space warp

# Search brains across your spaces
gobi brain search --query "machine learning"

# Ask a brain a question
gobi brain ask --vault-slug my-vault --question "What is RAG?"
```

## Commands

### Authentication

| Command | Description |
|---------|-------------|
| `gobi auth login` | Sign in via device code flow |
| `gobi auth status` | Show current auth status |
| `gobi auth logout` | Sign out and clear credentials |

### Setup

| Command | Description |
|---------|-------------|
| `gobi init` | Log in (if needed) and select or create a vault |
| `gobi space list` | List spaces you are a member of |
| `gobi space warp [spaceSlug]` | Select the active space (interactive if slug omitted) |

### Brains

| Command | Description |
|---------|-------------|
| `gobi brain search --query <q>` | Search public brains by text and semantic similarity |
| `gobi brain ask --vault-slug <slug> --question <q>` | Ask a brain a question (creates a 1:1 session) |
| `gobi brain publish` | Upload `BRAIN.md` to your vault |
| `gobi brain unpublish` | Remove `BRAIN.md` from your vault |

Public brains are accessible at `https://gobispace.com/@{vaultSlug}`.

`brain ask` also accepts `--rich-text <json>` (mutually exclusive with `--question`) and `--mode <auto|manual>`.

### Spaces

> Space and member administration (creating spaces, inviting/approving members, joining/leaving) is web-UI only and not available in the CLI.

| Command | Description |
|---------|-------------|
| `gobi space get [spaceSlug]` | Show space details (uses current space if slug omitted) |
| `gobi space messages` | Unified message feed (threads + replies, newest first) |
| `gobi space ancestors <threadId>` | Walk a thread/reply's lineage from root → immediate parent |

### Feed

| Command | Description |
|---------|-------------|
| `gobi feed list` | List recent brain updates from the global public feed |
| `gobi feed get <updateId>` | Get a feed brain update and its replies |
| `gobi feed post-reply <updateId> --content <c>` | Post a reply to a brain update in the feed |
| `gobi feed edit-reply <replyId> --content <c>` | Edit a reply you authored |
| `gobi feed delete-reply <replyId>` | Delete a reply you authored |

`feed list` and `feed get` accept `--limit`/`--cursor` for pagination.

### Threads

> **Migration note:** Brain-update commands have been removed. To post user-level content, use `gobi global create-thread` (global space) or `gobi space create-thread` (a specific space).

| Command | Description |
|---------|-------------|
| `gobi space list-threads` | List threads in the current space |
| `gobi space get-thread <id>` | Get a thread and its replies |
| `gobi space create-thread --title <t> --content <c>` | Create a thread |
| `gobi space edit-thread <id> [--title <t>] [--content <c>]` | Edit a thread (at least one required) |
| `gobi space delete-thread <id>` | Delete a thread |

### Replies

| Command | Description |
|---------|-------------|
| `gobi space create-reply <threadId> --content <c>` | Reply to a thread |
| `gobi space edit-reply <replyId> --content <c>` | Edit a reply |
| `gobi space delete-reply <replyId>` | Delete a reply |

### Global thread space

The global thread space is a slugless message feed visible across all spaces.

| Command | Description |
|---------|-------------|
| `gobi global messages` | List the global unified message feed (newest first) |
| `gobi global get-thread <id>` | Get a global thread and its direct replies |
| `gobi global ancestors <id>` | Walk a global thread/reply's lineage |
| `gobi global create-thread [--title <t>] (--content <c> \| --rich-text <json>)` | Create a thread in the global space |
| `gobi global reply <threadId> (--content <c> \| --rich-text <json>)` | Reply to a global thread |

### Sessions

| Command | Description |
|---------|-------------|
| `gobi session list` | List your sessions |
| `gobi session get <id>` | Get a session and its messages |
| `gobi session reply <id> --content <c>` | Send a message in a session |

`session reply` also accepts `--rich-text <json>` (mutually exclusive with `--content`).

### Sense

| Command | Description |
|---------|-------------|
| `gobi sense activities --start-time <iso> --end-time <iso>` | Fetch activity records in a time range |
| `gobi sense transcriptions --start-time <iso> --end-time <iso>` | Fetch transcription records in a time range |

Times are ISO 8601 UTC (e.g. `2026-03-20T00:00:00Z`).

### Notes

| Command | Description |
|---------|-------------|
| `gobi notes list [--date YYYY-MM-DD]` | List your notes (recent via cursor, or all for a day) |
| `gobi notes get <id>` | Get a single note |
| `gobi notes create --content <c>` | Create a note (use `-` to read content from stdin) |
| `gobi notes edit <id> [--content <c>] [--agent-id <id>]` | Edit a note (at least one required; `--agent-id null` clears the link) |
| `gobi notes delete <id>` | Delete a note you authored |

`notes list` and `notes create` accept `--timezone <iana>` (default: system timezone) for day boundaries.
`notes list` also accepts `--limit`/`--cursor` for pagination.

### Proposals

Proposals are authored by your agent during chat (or by external agents using `gobi proposal add` as their tool layer). The top 5 pending proposals (lowest priority first) feed the agent's system prompt every turn. Every proposal is anchored to the chat session that produced it.

| Command | Description |
|---------|-------------|
| `gobi proposal list [--limit N]` | List proposals (priority ASC, then newest first) |
| `gobi proposal get <id>` | Show one proposal with its history |
| `gobi proposal add <title> <content> [--session <id>] [--priority N]` | Add a proposal (use `-` for content to read from stdin). `--session` falls back to `$GOBI_SESSION_ID`. |
| `gobi proposal edit <id> [--title <t>] [--content <c>]` | Update title and/or content; bumps revision (use `-` for stdin) |
| `gobi proposal delete <id>` | Delete a proposal |
| `gobi proposal prioritize <id> <priority>` | Set priority (lower = higher) |
| `gobi proposal accept <id>` | Mark as accepted (the client posts the synthesized message into the session) |
| `gobi proposal reject <id>` | Mark as rejected |
| `gobi proposal revise <id> <comment>` | Mark for revision and record the user's comment |

### Sync

| Command | Description |
|---------|-------------|
| `gobi sync` | Sync local vault files with Gobi Webdrive |

| Option | Description |
|--------|-------------|
| `--upload-only` | Only upload local changes to server |
| `--download-only` | Only download server changes to local |
| `--conflict <strategy>` | Conflict resolution: `ask` (default), `server`, `client`, `skip` |
| `--dir <path>` | Local vault directory (default: current directory) |
| `--dry-run` | Preview changes without making them |
| `--full` | Full sync: ignore cursor and hash cache, re-check every file |
| `--path <path>` | Restrict sync to specific file/folder (repeatable) |
| `--plan-file <path>` | Write dry-run plan to file, or read plan to execute |
| `--execute` | Execute a previously written plan file (requires `--plan-file`) |
| `--conflict-choices <json>` | Per-file conflict resolutions as JSON (use with `--execute`) |

### Global options

| Option | Scope | Description |
|--------|-------|-------------|
| `--json` | All commands | Output results as JSON |
| `--space-slug <slug>` | `space` commands | Override the default space (from `.gobi/settings.yaml`) |
| `--vault-slug <slug>` | Per-command | Override the default vault; available on `space create-thread`, `space edit-thread`, `space edit-reply` |

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOBI_BASE_URL` | `https://api.joingobi.com` | API server URL |
| `GOBI_WEBDRIVE_BASE_URL` | `https://webdrive.joingobi.com` | File storage URL |

### Files

| Path | Description |
|------|-------------|
| `~/.gobi/credentials.json` | Stored authentication tokens |
| `.gobi/settings.yaml` | Per-project vault and space configuration |

## Development

```sh
git clone https://github.com/gobi-ai/gobi-cli.git
cd gobi-cli
npm install
npm run build
npm test
```

Run from source without compiling:

```sh
npm run dev -- auth status
```

## License

[MIT](LICENSE)

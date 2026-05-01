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
# Initialize — logs in and sets up your vault (creates PUBLISH.md)
gobi init

# Select a space
gobi space warp

# Publish your vault profile (after editing PUBLISH.md frontmatter)
gobi vault publish

# Sync local files with the webdrive
gobi vault sync

# Browse the global feed and create a post
gobi global feed
gobi global create-post --title "Hello" --content "Trying gobi"
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
| `gobi init` | Log in (if needed) and select or create a vault. Creates `PUBLISH.md` if missing. |
| `gobi space list` | List spaces you are a member of |
| `gobi space warp [spaceSlug]` | Select the active space (interactive if slug omitted) |

### Vault

| Command | Description |
|---------|-------------|
| `gobi vault publish` | Upload `PUBLISH.md` to your vault. Triggers profile/metadata refresh. |
| `gobi vault unpublish` | Remove `PUBLISH.md` from your vault. |
| `gobi vault sync` | Sync local vault files with Gobi Webdrive. |

Public vaults are accessible at `https://gobispace.com/@{vaultSlug}`.

`vault sync` options:

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

### Spaces

> Space and member administration (creating spaces, inviting/approving members, joining/leaving) is web-UI only and not available in the CLI.

| Command | Description |
|---------|-------------|
| `gobi space get [spaceSlug]` | Show space details (uses current space if slug omitted) |
| `gobi space feed` | Unified feed (posts + replies, newest first) in the space |
| `gobi space list-topics` | List topics in the space, ordered by most recent linkage |
| `gobi space list-topic-posts <topicSlug>` | List posts tagged with a topic |
| `gobi space list-posts` | List posts in the space |
| `gobi space get-post <postId>` | Get a post with its ancestors and replies |
| `gobi space create-post --title <t> --content <c>` | Create a post |
| `gobi space edit-post <postId> [--title <t>] [--content <c>]` | Edit a post (at least one required) |
| `gobi space delete-post <postId>` | Delete a post |
| `gobi space create-reply <postId> --content <c>` | Reply to a post |
| `gobi space edit-reply <replyId> --content <c>` | Edit a reply |
| `gobi space delete-reply <replyId>` | Delete a reply |

### Global feed

The global feed is the public, slugless feed of vault-authored posts visible across all spaces.

| Command | Description |
|---------|-------------|
| `gobi global feed` | List the global public feed (posts + replies, newest first) |
| `gobi global list-posts [--mine] [--vault-slug <slug>]` | List posts in the global feed |
| `gobi global get-post <postId>` | Get a global post with its ancestors and replies |
| `gobi global create-post [--title <t>] (--content <c> \| --rich-text <json>)` | Create a post in the global feed |
| `gobi global edit-post <postId> [--title <t>] [--content <c>]` | Edit a post you authored |
| `gobi global delete-post <postId>` | Delete a post you authored |
| `gobi global create-reply <postId> (--content <c> \| --rich-text <json>)` | Reply to a global post |
| `gobi global edit-reply <replyId> --content <c>` | Edit a reply you authored |
| `gobi global delete-reply <replyId>` | Delete a reply you authored |

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

### Saved

`gobi saved` is the user's personal saved-knowledge collection — notes you author and posts you bookmark.

#### Saved notes

| Command | Description |
|---------|-------------|
| `gobi saved note list [--date YYYY-MM-DD]` | List your notes (recent via cursor, or all for a day) |
| `gobi saved note get <id>` | Get a single note |
| `gobi saved note create --content <c>` | Create a note (use `-` to read content from stdin) |
| `gobi saved note edit <id> [--content <c>] [--agent-id <id>]` | Edit a note (at least one required; `--agent-id null` clears the link) |
| `gobi saved note delete <id>` | Delete a note you authored |

`saved note list` and `saved note create` accept `--timezone <iana>` (default: system timezone).

#### Saved posts

| Command | Description |
|---------|-------------|
| `gobi saved post list [--type all\|article\|space-post]` | List posts you've saved |
| `gobi saved post get <postId>` | Get a saved post snapshot |
| `gobi saved post create --source <id>` | Save a post or reply by id |
| `gobi saved post delete <postId>` | Remove a post from your saved collection |

### Drafts

Drafts are authored by your agent during chat (or by external agents using `gobi draft add` as their tool layer). Each draft carries 0–3 AI-suggested actions the user can pick from. The top 5 pending drafts (lowest priority first) feed the agent's system prompt every turn. Every draft is anchored to the chat session that produced it.

| Command | Description |
|---------|-------------|
| `gobi draft list [--limit N]` | List drafts (priority ASC, then newest first) |
| `gobi draft get <id>` | Show one draft with its history and suggested actions |
| `gobi draft add <title> <content> [--session <id>] [--priority N] [--action <label>]…` | Add a draft. Pass `--action` up to 3 times to attach AI-suggested actions. `--session` falls back to `$GOBI_SESSION_ID`. Use `-` for content to read from stdin. |
| `gobi draft delete <id>` | Delete a draft |
| `gobi draft prioritize <id> <priority>` | Set priority (lower = higher) |
| `gobi draft action <id> <index>` | Take one of the draft's suggested actions by 0-based index. Marks `actioned` and posts the synthesized message into the originating session. |
| `gobi draft revise <id> <comment> [--title <t>] [--content <c>] [--action <label>]…` | Bump revision with a comment; optionally replace title / content / actions in the same call |

### Global options

| Option | Scope | Description |
|--------|-------|-------------|
| `--json` | All commands | Output results as JSON |
| `--space-slug <slug>` | `space` commands | Override the default space (from `.gobi/settings.yaml`) |
| `--vault-slug <slug>` | Per-command | Override the default vault; available on post/reply commands that upload attachments and on `global create-post` |

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
| `PUBLISH.md` | Vault profile document with YAML frontmatter, published via `gobi vault publish` |

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

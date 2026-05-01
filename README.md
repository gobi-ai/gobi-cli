# gobi-cli

[![CI](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gobi-ai/cli)](https://www.npmjs.com/package/@gobi-ai/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

The programmatic interface to [Gobi](https://gobispace.com) — the agent-facing surface of the ecosystem. The same capabilities the desktop and web clients use (auth, vault sync and publishing, personal posts and replies, saved knowledge, drafts, media generation, activity reads) exposed as composable shell commands so AI agents and developer scripts can participate in a user's Brain.

## Why a CLI?

Most Gobi capabilities are interactive surfaces (Desktop, Web, Mobile). The CLI flips that: every command is scriptable, returns structured JSON when asked, and uses headless device-code auth so an agent can run it on any host. If you're building an agent that needs to read from or write to a user's Brain — capture notes, post to a community space, save a snippet, draft a suggestion, generate an image — this is the surface.

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
# Initialize — log in and set up your vault (creates PUBLISH.md if missing)
gobi init

# Select a community space
gobi space warp

# Publish your vault profile (after editing PUBLISH.md frontmatter)
gobi vault publish

# Sync local files with the webdrive
gobi vault sync

# Browse the global feed and create a personal post
gobi global feed
gobi global create-post --title "Hello" --content "Trying gobi" --vault-slug my-vault
```

---

## Using gobi from an agent

Everything below applies whether you're building a Claude Code skill, an autonomous agent, or a shell script. The CLI was designed to be agent-driven first.

### JSON envelope

Pass `--json` as a **global flag** (before the subcommand) and every command returns a structured envelope:

```sh
gobi --json space list-posts
# {"success": true, "data": [...]}

gobi --json space get-post 99999
# {"success": false, "error": "Post not found"}
```

`success: true` always carries `data`; `success: false` always carries `error`. Pagination metadata (`pagination: { hasMore, nextCursor }`) ships alongside `data` on list endpoints. Skill docs and the `--help` output describe each command's `data` shape.

### Context discovery

The CLI looks up two pieces of state:

| Path | What | Who manages |
|------|------|-------------|
| `~/.gobi/credentials.json` | Auth tokens (`accessToken`, `refreshToken`) | `gobi auth login` writes; `gobi auth logout` clears |
| `.gobi/settings.yaml` | Per-project `vaultSlug` and `selectedSpaceSlug` | `gobi init` and `gobi space warp` write |

An agent should check these before calling commands that need a vault or space:

```sh
# Are we authenticated?
gobi --json auth status

# Discover the project's defaults
cat .gobi/settings.yaml 2>/dev/null
```

If `.gobi/settings.yaml` is missing, `gobi init` and `gobi space warp` are the interactive entry points — they require user input, so an agent should hand off to the user rather than trying to drive them silently.

Every command that depends on a vault or space accepts an explicit override (`--vault-slug`, `--space-slug`) so an agent can act without ambient state.

### Headless auth

`gobi auth login` is a device-code flow: it prints a URL and a user code to stdout, then polls. An agent can run it as a background task, surface the URL to the user as a clickable link, and wait for the process to exit. See [`commands/login.md`](commands/login.md) for the canonical agent recipe.

### Per-session context for drafts

When the runtime exports `GOBI_SESSION_ID`, `gobi draft add` picks it up automatically — no need to pass `--session` from inside an agent run. See the **Drafts** section below.

---

## Commands

### Authentication

| Command | Description |
|---------|-------------|
| `gobi auth login` | Sign in via device-code flow |
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
| `gobi vault sync` | Sync local vault files with Gobi WebDrive. |

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

A *Space* is a community knowledge area. A *Space Post* lives in one space. The same `Post` data type, in a different scope, is a *Personal Post* (see Global feed below) — so anything you can do to a Space Post you can do to a Personal Post.

> Space and member administration (creating spaces, inviting/approving members, joining/leaving) is web-UI only and not available in the CLI.

| Command | Description |
|---------|-------------|
| `gobi space get [spaceSlug]` | Show space details (uses current space if slug omitted) |
| `gobi space feed` | Unified feed (posts + replies, newest first) in the space |
| `gobi space list-topics` | List topics in the space, ordered by most recent linkage |
| `gobi space list-topic-posts <topicSlug>` | List posts tagged with a topic |
| `gobi space list-posts` | List posts in the space |
| `gobi space get-post <postId>` | Get a post with its ancestors and replies |
| `gobi space create-post --title <t> --content <c> [--vault-slug <slug>] [--auto-attachments]` | Create a space post. `--vault-slug` attributes it to a vault you own; `--auto-attachments` uploads `[[wikilinks]]` to that vault and uses it as `authorVaultSlug`. |
| `gobi space edit-post <postId> [--title <t>] [--content <c>] [--vault-slug <slug>] [--auto-attachments]` | Edit a space post. `--vault-slug ""` detaches the vault. |
| `gobi space delete-post <postId>` | Delete a space post |
| `gobi space create-reply <postId> --content <c>` | Reply to a space post |
| `gobi space edit-reply <replyId> --content <c>` | Edit a reply |
| `gobi space delete-reply <replyId>` | Delete a reply |

### Global feed (personal posts)

A *Personal Post* lives on the author's profile (their primary vault) and surfaces in the public global feed. Same `Post` model as a Space Post, scoped to the user instead of a space.

| Command | Description |
|---------|-------------|
| `gobi global feed` | List the global public feed (posts + replies, newest first) |
| `gobi global list-posts [--mine] [--vault-slug <slug>]` | List personal posts; filter to your own or by author vault |
| `gobi global get-post <postId>` | Get a personal post with its ancestors and replies |
| `gobi global create-post [--title <t>] (--content <c> \| --rich-text <json>) [--vault-slug <slug>] [--auto-attachments]` | Create a personal post |
| `gobi global edit-post <postId> [--title <t>] [--content <c>] [--vault-slug <slug>]` | Edit a personal post you authored. `--vault-slug ""` detaches the vault. |
| `gobi global delete-post <postId>` | Delete a personal post you authored |
| `gobi global create-reply <postId> (--content <c> \| --rich-text <json>)` | Reply to a personal post |
| `gobi global edit-reply <replyId> --content <c>` | Edit a reply you authored |
| `gobi global delete-reply <replyId>` | Delete a reply you authored |

`--vault-slug` requires that the caller hold `role: 'owner'` on the target vault. When set, it becomes the post's `authorVaultSlug`. When `--auto-attachments` is set, the same vault is used both as the upload destination for `[[wikilinks]]` and as `authorVaultSlug`.

### Sessions

| Command | Description |
|---------|-------------|
| `gobi session list` | List your sessions |
| `gobi session get <id>` | Get a session and its messages |
| `gobi session reply <id> --content <c>` | Send a message in a session |

`session reply` also accepts `--rich-text <json>` (mutually exclusive with `--content`).

### Sense

Activity and transcription data captured by Gobi Sense (or the mobile app).

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
| `gobi saved note edit <id> [--content <c>] [--agent-id <id>]` | Edit a note (`--agent-id null` clears the link) |
| `gobi saved note delete <id>` | Delete a note you authored |

`saved note list` and `saved note create` accept `--timezone <iana>` (default: system timezone).

#### Saved posts

| Command | Description |
|---------|-------------|
| `gobi saved post list [--type all\|article\|space-post]` | List posts you've saved |
| `gobi saved post get <postId>` | Get a saved post snapshot |
| `gobi saved post create --source <id>` | Save a post or reply by id (records a snapshot) |
| `gobi saved post delete <postId>` | Remove a post from your saved collection |

### Drafts

A *draft* is a unit of standing guidance authored by an agent. Each draft carries 0–3 AI-suggested actions the user picks from. The top 5 pending drafts (lowest priority first) are injected into the agent's system prompt every turn — drafts turn agent suggestions into running context.

When invoked from inside an agent run, the runtime exports `GOBI_SESSION_ID` so `gobi draft add` picks it up automatically; otherwise pass `--session <uuid>`.

Each action is `{ label, message? }`: `label` is the short button text (1–80 chars) the user sees; `message` (optional, ≤2000 chars) is what the user is taken to be saying to the agent on click. When `message` is omitted, the client falls back to `label`. From the CLI, pass an action as `--action "Label::Message"` — the literal `::` separates the two. Without `::`, the whole value is the label.

| Command | Description |
|---------|-------------|
| `gobi draft list [--limit N]` | List drafts (priority ASC, then newest first) |
| `gobi draft get <id>` | Show one draft with its history and suggested actions |
| `gobi draft add <title> <content> [--session <id>] [--priority N] [--action <label[::message]>]…` | Add a draft. Pass `--action` up to 3 times; each action is `Label` or `Label::Message`. `--session` falls back to `$GOBI_SESSION_ID`. Use `-` for content to read from stdin. |
| `gobi draft delete <id>` | Delete a draft |
| `gobi draft prioritize <id> <priority>` | Set priority (lower = higher) |
| `gobi draft action <id> <index>` | Take one of the draft's suggested actions by 0-based index. Marks `actioned` and posts the action's `message` (or `label`, if no message) into the originating session. |
| `gobi draft revise <id> <comment> [--title <t>] [--content <c>] [--action <label[::message]>]…` | Bump revision with a comment; optionally replace title / content / actions in the same call |

### Media generation

Image, video, and avatar generation. See the `gobi-media` skill for full workflows.

| Command | Description |
|---------|-------------|
| `gobi media image-generate --prompt <p> [--aspect-ratio <r>] [-o <file>]` | Generate an image (use `-o` to wait + download) |
| `gobi media image-edit --image <f> --prompt <p>` | Edit/inpaint an image |
| `gobi media video-create --avatar-id <a> --voice-id <v> --script <s>` | Avatar video with voice narration |
| `gobi media cinematic-create --prompt <p>` | Cinematic video from a text prompt |
| `gobi media avatar-design / avatar-from-selfie` | Custom avatars from prompts or selfies |
| `gobi media avatars` / `gobi media voices` | List available avatars and voices |
| `gobi media upload <file>` | Upload a local file and get a media id |

### Global options

| Option | Scope | Description |
|--------|-------|-------------|
| `--json` | All commands | Output structured JSON (`{success, data}` / `{success, error}`) |
| `--space-slug <slug>` | `space` commands | Override the default space (from `.gobi/settings.yaml`) |
| `--vault-slug <slug>` | Per-command | Override the default vault — see each command's docs |

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOBI_BASE_URL` | `https://api.joingobi.com` | API server URL |
| `GOBI_WEBDRIVE_BASE_URL` | `https://webdrive.joingobi.com` | File storage URL |
| `GOBI_SESSION_ID` | — | Default `--session` for `gobi draft add` (set automatically inside agent runs) |

### Files

| Path | Description |
|------|-------------|
| `~/.gobi/credentials.json` | Stored authentication tokens |
| `.gobi/settings.yaml` | Per-project vault and space configuration |
| `.gobi/syncfiles` | Whitelist patterns for `gobi vault sync` (one per line) |
| `.gobi/sync.db` | Local sync state (cursor, hash cache) — managed by the CLI |
| `PUBLISH.md` | Vault profile document with YAML frontmatter, published via `gobi vault publish` |

## Claude Code skills

The CLI ships a `.claude-plugin/` manifest with eight skills that wrap the command groups for Claude Code agents:

| Skill | Covers |
|-------|--------|
| `gobi-core` | Auth, init, session, update, space list/warp |
| `gobi-vault` | `gobi vault publish/unpublish/sync` |
| `gobi-space` | `gobi space …` and `gobi global …` |
| `gobi-saved` | `gobi saved note …` and `gobi saved post …` |
| `gobi-draft` | `gobi draft …` |
| `gobi-media` | `gobi media …` |
| `gobi-sense` | `gobi sense activities/transcriptions` |
| `gobi-homepage` | Building custom HTML homepages with `window.gobi` |

Each skill's `SKILL.md` is hand-written orientation; `references/` is regenerated from `--help` output by `npm run generate-skill-docs`.

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

Tests run against `dist/*.test.js` (built JS), so `npm run build` is a prerequisite for `npm test`.

## License

[MIT](LICENSE)

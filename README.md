# gobi-cli

[![CI](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gobi-ai/cli)](https://www.npmjs.com/package/@gobi-ai/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

The programmatic interface to [Gobi](https://gobispace.com) — the agent-facing surface of the ecosystem. The same capabilities the desktop and web clients use (auth, vault sync and publishing, personal posts and replies, drafts, media generation, activity reads) exposed as composable shell commands so AI agents and developer scripts can act on a user's behalf in Gobi.

## Why a CLI?

Most Gobi capabilities are interactive surfaces (Desktop, Web, Mobile). The CLI flips that: every command is scriptable, returns structured JSON when asked, and uses headless device-code auth so an agent can run it on any host. If you're building an agent that needs to work in a user's Gobi — capture notes, post to a community space, draft a suggestion, generate an image — this is the surface.

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
# Sign in (device-code flow — opens a URL, you authorize, the CLI polls)
gobi auth login

# Set up the vault for the current directory (creates PUBLISH.md if missing)
gobi vault init

# Select a community space for the current directory
gobi space warp

# Publish your vault profile (after editing PUBLISH.md frontmatter)
gobi vault publish

# Sync local files with the webdrive
gobi vault sync

# Browse the global feed and create a personal post
gobi global feed
gobi global create-post --title "Hello" --content "Trying gobi"
```

Each setup step unlocks a different family of commands — run only the ones the workflow needs:

| Step | Unlocks |
|------|---------|
| `gobi auth login` | All authenticated commands |
| `gobi vault init` | Every `gobi vault …` command (`publish`, `unpublish`, `sync`); also lets `global create-post --auto-attachments` resolve that vault automatically |
| `gobi space warp` | Every `gobi space …` command without needing `--space-slug` |

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
| `.gobi/settings.yaml` | Per-project `vaultSlug` and `selectedSpaceSlug` | `gobi vault init` and `gobi space warp` write |

An agent should check these before calling commands that need a vault or space:

```sh
# Are we authenticated?
gobi --json auth status

# Discover the project's defaults
cat .gobi/settings.yaml 2>/dev/null
```

If `.gobi/settings.yaml` is missing, `gobi vault init` and `gobi space warp` are the interactive entry points — they require user input, so an agent should hand off to the user rather than trying to drive them silently.

`gobi space …` commands accept `--space-slug <slug>` (on the parent group or any subcommand) to override the default space. Per-command `--vault-slug` overrides are documented inline.

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
| `gobi vault init` | Select or create the vault for this directory. Writes `vaultSlug` to `.gobi/settings.yaml` and seeds `PUBLISH.md`. |
| `gobi vault list` | List vaults you own |
| `gobi space list` | List spaces you are a member of |
| `gobi space warp [spaceSlug]` | Select the active space (interactive if slug omitted) |

### Vault

| Command | Description |
|---------|-------------|
| `gobi vault create <slug> --name <n>` | Create a new vault. Does not change the configured vault — run `gobi vault init` or `gobi vault set-primary` afterwards if you want to anchor to it. |
| `gobi vault rename <newName> [--vault-slug <slug>]` | Rename a vault. Defaults to the configured vault. Local display name only — does not affect `PUBLISH.md` frontmatter. |
| `gobi vault delete <slug>` | Delete a vault. Irreversible. The API rejects if the vault still owns content; clean up posts, members, and files first. |
| `gobi vault set-primary <slug>` | Mark a vault as your primary. Unsets primary on the others. |
| `gobi vault publish` | Upload `PUBLISH.md` to your vault. Triggers profile/metadata refresh. |
| `gobi vault unpublish` | Remove `PUBLISH.md` from your vault. |
| `gobi vault status [--vault-slug <slug>]` | Show the configured vault's publish state (`isPublished`), profile fields, file count, and public profile URL. Useful as a pre-flight check before posting with `--auto-attachments`. |
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
| `gobi space get-post <postId> [--full]` | Get a post with its ancestors and replies. `--full` shows reply content without truncation. |
| `gobi space create-post [--title <t>] (--content <c> \| --rich-text <json> \| --draft-id <id>) [--vault-slug <slug>] [--auto-attachments] [--repost-post-id <id>] [--attach <file>]…` | Create a space post. Must provide content via one of `--content`, `--rich-text`, or `--draft-id`. `--vault-slug` attributes it to a vault you own; `--auto-attachments` uploads `[[wikilinks]]` to that vault and uses it as `authorVaultSlug`. `--draft-id` links the post back to a draft (records `postId`/`spaceSlug` on `draft.metadata` so the client can render an "Open post" button). `--repost-post-id` reposts an existing post (sets `repostPostId` on the new post). `--attach` uploads local media to render inline in-feed (repeatable; X-style mix rule — up to 4 photos OR 1 GIF OR 1 video). |
| `gobi space edit-post <postId> [--title <t>] [--content <c>] [--vault-slug <slug>] [--auto-attachments]` | Edit a space post. `--vault-slug ""` detaches the vault. |
| `gobi space delete-post <postId>` | Delete a space post |
| `gobi space create-reply <postId> (--content <c> \| --rich-text <json>) [--vault-slug <slug>] [--auto-attachments] [--attach <file>]…` | Create a reply to a space post. `--attach` works the same as on `create-post`. |
| `gobi space edit-reply <replyId> [--content <c>] [--rich-text <json>] [--vault-slug <slug>] [--auto-attachments]` | Edit a reply you authored. `--vault-slug ""` detaches attribution. |
| `gobi space delete-reply <replyId>` | Delete a reply you authored |

### Global feed (personal posts)

A *Personal Post* surfaces in the public global feed. Pass `--vault-slug` to attribute it to a vault you own (it'll then surface on that vault's profile too); with no `--vault-slug` and no `--auto-attachments` the post has no `authorVaultSlug` and lives only on the global feed. Same `Post` model as a Space Post, scoped to the user instead of a space.

| Command | Description |
|---------|-------------|
| `gobi global feed [--following]` | List the global public feed (posts + replies, newest first). `--following` limits to authors you follow. |
| `gobi global list-posts [--mine] [--vault-slug <slug>]` | List personal posts; filter to your own or by author vault |
| `gobi global get-post <postId> [--full]` | Get a personal post with its ancestors and replies. `--full` shows reply content without truncation. |
| `gobi global create-post [--title <t>] (--content <c> \| --rich-text <json>) [--vault-slug <slug>] [--auto-attachments] [--draft-id <id>] [--repost-post-id <id>] [--attach <file>]…` | Create a personal post. `--draft-id` links the post back to a draft (records `postId` on `draft.metadata`). `--repost-post-id` reposts an existing post. `--attach` uploads local media for inline rendering (see `gobi space create-post` above for the mix rule). |
| `gobi global edit-post <postId> [--title <t>] [--content <c>] [--vault-slug <slug>]` | Edit a personal post you authored. `--vault-slug ""` detaches the vault. |
| `gobi global delete-post <postId>` | Delete a personal post you authored |
| `gobi global create-reply <postId> (--content <c> \| --rich-text <json>) [--vault-slug <slug>] [--auto-attachments] [--attach <file>]…` | Create a reply to a personal post |
| `gobi global edit-reply <replyId> [--content <c>] [--rich-text <json>] [--vault-slug <slug>] [--auto-attachments]` | Edit a reply you authored. `--vault-slug ""` detaches attribution. |
| `gobi global delete-reply <replyId>` | Delete a reply you authored |

`--vault-slug` requires that the caller hold `role: 'owner'` on the target vault. When set, it becomes the post's `authorVaultSlug`. When `--auto-attachments` is set, the same vault is used both as the upload destination for `[[wikilinks]]` and as `authorVaultSlug`.

### Personal space (private posts)

> Naming note: a **Personal Post** (under `gobi global`, above) is the public-feed kind — it lives on your vault profile and surfaces on the global feed. A **personal-space post** (this section, under `gobi personal`) is the private kind — same `Post` data model, but scoped via `personalSpaceUserId` so only you can see it.

Private posts and replies visible only to you. Same `Post` data model and subcommand shape as `gobi global`, but scoped to a personal space — they never appear on the public global feed.

| Command | Description |
|---------|-------------|
| `gobi personal feed` | Your personal-space feed (posts + replies, newest first) |
| `gobi personal list-posts` | List personal-space posts |
| `gobi personal get-post <postId> [--full]` | Get a personal-space post with its ancestors and replies |
| `gobi personal create-post [--title <t>] (--content <c> \| --rich-text <json>) [--vault-slug <slug>] [--auto-attachments] [--draft-id <id>] [--repost-post-id <id>] [--attach <file>]…` | Create a private post in your personal space. `--vault-slug` attributes it to a vault you own. `--attach` works the same as on `gobi global create-post`. |
| `gobi personal edit-post <postId> [--title <t>] [--content <c>] [--vault-slug <slug>] [--auto-attachments]` | Edit a personal-space post you authored |
| `gobi personal delete-post <postId>` | Delete a personal-space post you authored |
| `gobi personal create-reply <postId> (--content <c> \| --rich-text <json>) [--vault-slug <slug>] [--auto-attachments] [--attach <file>]…` | Reply to a personal-space post (inherits the parent's private scope) |
| `gobi personal edit-reply <replyId> [--content <c>] [--rich-text <json>] [--vault-slug <slug>] [--auto-attachments]` | Edit a reply you authored |
| `gobi personal delete-reply <replyId>` | Delete a reply you authored |

### Sense

Activity and transcription data captured by Gobi Sense (or the mobile app).

| Command | Description |
|---------|-------------|
| `gobi sense list-activities --start-time <iso> --end-time <iso>` | List activity records in a time range |
| `gobi sense list-transcriptions --start-time <iso> --end-time <iso>` | List transcription records in a time range |

Times are ISO 8601 UTC (e.g. `2026-03-20T00:00:00Z`).

### Drafts

A *draft* is a unit of standing guidance authored by an agent. Each draft carries 0–3 AI-suggested actions the user picks from. The top 5 pending drafts (lowest priority first) are injected into the agent's system prompt every turn — drafts turn agent suggestions into running context.

When invoked from inside an agent run, the runtime exports `GOBI_SESSION_ID` so `gobi draft add` picks it up automatically; otherwise pass `--session <uuid>`.

Each action is `{ label, message? }`: `label` is the short button text (1–80 chars) the user sees; `message` (optional, ≤2000 chars) is what the user is taken to be saying to the agent on click. When `message` is omitted, the client falls back to `label`. From the CLI, pass an action as `--action "Label::Message"` — the literal `::` separates the two. Without `::`, the whole value is the label.

| Command | Description |
|---------|-------------|
| `gobi draft list [--limit N]` | List drafts (priority ASC, then newest first) |
| `gobi draft get <id>` | Get one draft with its history and suggested actions |
| `gobi draft add <title> <content> [--session <id>] [--vault-slug <slug>] [--priority N] [--action <label[::message]>]…` | Add a draft. Pass `--action` up to 3 times; each action is `Label` or `Label::Message`. `--session` falls back to `$GOBI_SESSION_ID`. `--vault-slug` anchors the draft to a specific vault (must be one you own). Use `-` for content to read from stdin. |
| `gobi draft delete <id>` | Delete a draft |
| `gobi draft prioritize <id> <priority>` | Set priority (lower = higher) |
| `gobi draft action <id> <index>` | Take one of the draft's suggested actions by 0-based index. Marks `actioned` and posts the action's `message` (or `label`, if no message) into the originating session. |
| `gobi draft revise <id> <comment> [--title <t>] [--content <c>] [--vault-slug <slug>] [--action <label[::message]>]…` | Bump revision with a comment; optionally replace title / content / vault-slug / actions in the same call |

### Media generation

Image, video, and avatar generation. See the `gobi-media` skill for full workflows.

| Command | Description |
|---------|-------------|
| `gobi media generate-image --prompt <p> [--aspect-ratio <r>] [-o <file>]` | Generate an image (use `-o` to wait + download) |
| `gobi media edit-image --image <f> --prompt <p>` | Edit an image with a prompt |
| `gobi media inpaint-image --image <f> --mask <m> --prompt <p>` | Inpaint a masked region |
| `gobi media get-image-status <jobId>` / `download-image <jobId>` | Poll an image job or download the result |
| `gobi media create-video --avatar-id <a> --voice-id <v> --script <s>` | Avatar video with voice narration |
| `gobi media create-cinematic --prompt <p>` | Cinematic video from a text prompt |
| `gobi media get-video-status <videoId>` / `download-video <videoId>` | Poll a video job or download the result |
| `gobi media design-avatar / design-avatar-from-selfie / confirm-avatar` | Custom avatars from prompts or selfies; confirm a variant after design |
| `gobi media get-avatar-job-status <jobId>` | Poll an avatar design job |
| `gobi media list-avatars` / `gobi media list-voices` | List available avatars and voices |
| `gobi media list-videos` / `gobi media get-video <id>` | List or get videos |
| `gobi media upload <file>` | Upload a local file and get a media id |

### Global options

| Option | Scope | Description |
|--------|-------|-------------|
| `--json` | All non-interactive commands | Output structured JSON (`{success, data}` / `{success, error}`). Interactive commands (`gobi auth login`, `gobi vault init`, `gobi update`, `gobi space warp` without a slug) prompt, poll, or stream subprocess output and ignore `--json`. |
| `--space-slug <slug>` | `space` commands | Override the default space (from `.gobi/settings.yaml`) |
| `--vault-slug <slug>` | Per-command | Override the default vault — see each command's docs |

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOBI_BASE_URL` | `https://api.joingobi.com` | API server URL |
| `GOBI_WEBDRIVE_BASE_URL` | `https://webdrive.joingobi.com` | File storage URL |
| `GOBI_WEB_BASE_URL` | `https://gobispace.com` | Public web URL (used when assembling shareable links) |
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

The CLI ships a `.claude-plugin/` manifest with skills that wrap the command groups for Claude Code agents:

| Skill | Covers |
|-------|--------|
| `gobi-core` | Auth, update, space list/warp |
| `gobi-vault` | `gobi vault init/list/publish/unpublish/sync` |
| `gobi-space` | `gobi space …`, `gobi global …`, and `gobi personal …` |
| `gobi-draft` | `gobi draft …` |
| `gobi-media` | `gobi media …` |
| `gobi-sense` | `gobi sense list-activities/list-transcriptions` |
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

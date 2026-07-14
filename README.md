# gobi-cli

[![CI](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gobi-ai/cli)](https://www.npmjs.com/package/@gobi-ai/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

The programmatic interface to [Gobi](https://gobispace.com) — the agent-facing surface of the ecosystem. The same capabilities the desktop and web clients use (auth, vault sync and publishing, personal posts and replies, artifacts, media generation, activity reads) exposed as composable shell commands so AI agents and developer scripts can act on a user's behalf in Gobi.

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

# Browse your personal feed and create a private post
gobi personal feed
gobi personal create-post --title "Hello" --content "Trying gobi"
```

Each setup step unlocks a different family of commands — run only the ones the workflow needs:

| Step | Unlocks |
|------|---------|
| `gobi auth login` | All authenticated commands |
| `gobi vault init` | Every `gobi vault …` command (`publish`, `unpublish`, `sync`); also lets `<scope> artifact create --auto-attachments` resolve that vault automatically |
| `gobi space warp` | Every `gobi space …` command without needing `--space-slug` |

---

## Using gobi from an agent

Everything below applies whether you're building a Claude Code skill, an autonomous agent, or a shell script. The CLI was designed to be agent-driven first.

### JSON envelope

Pass `--json` as a **top-level flag** (before the subcommand) and every command returns a structured envelope:

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
| `gobi vault create <slug> --name <n>` | Create a new vault. Does not change the configured vault — run `gobi vault init` afterwards if you want to anchor to it. |
| `gobi vault rename <newName> [--vault-slug <slug>]` | Rename a vault. Defaults to the configured vault. Local display name only — does not affect `PUBLISH.md` frontmatter. |
| `gobi vault delete <slug>` | Delete a vault. Irreversible. The API rejects if the vault still owns content; clean up posts, members, and files first. |
| `gobi vault publish` | Upload `PUBLISH.md` to your vault. Triggers profile/metadata refresh. |
| `gobi vault unpublish` | Remove `PUBLISH.md` from your vault. |
| `gobi vault status [--vault-slug <slug>]` | Show the configured vault's publish state (`isPublished`), profile fields, file count, and public profile URL. Useful as a pre-flight check before authoring a markdown artifact with `--auto-attachments`. |
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

A *Space* is a community knowledge area. A *Space Post* lives in one space. The same `Post` data type, in a different scope, is a private *personal-space post* (see Personal space below) — so anything you can do to a Space Post you can do to a personal-space post.

> Space and member administration (creating spaces, inviting/approving members, joining/leaving) is web-UI only and not available in the CLI.

| Command | Description |
|---------|-------------|
| `gobi space get [spaceSlug]` | Show space details (uses current space if slug omitted) |
| `gobi space feed` | Unified feed (posts + replies, newest first) in the space |
| `gobi space list-topics` | List topics in the space, ordered by most recent linkage |
| `gobi space list-topic-posts <topicSlug>` | List posts tagged with a topic |
| `gobi space list-posts` | List posts in the space |
| `gobi space get-post <postId> [--full]` | Get a post with its ancestors and replies. `--full` shows reply content without truncation. |
| `gobi space create-post [--title <t>] (--content <c> \| --rich-text <json>) [--artifact <artifactId>]… [--repost-post-id <id>] [--attach <file>]…` | Create a space post. Must provide content via `--content` or `--rich-text`. `--artifact` attaches an existing artifact to the post (repeatable). `--repost-post-id` reposts an existing post (sets `repostPostId` on the new post). `--attach` uploads local media to render inline in-feed (repeatable; X-style mix rule — up to 4 photos OR 1 GIF OR 1 video). |
| `gobi space edit-post <postId> [--title <t>] [--content <c>]` | Edit a space post. |
| `gobi space delete-post <postId>` | Delete a space post |
| `gobi space create-reply <postId> (--content <c> \| --rich-text <json>) [--attach <file>]…` | Create a reply to a space post. `--attach` works the same as on `create-post`. |
| `gobi space edit-reply <replyId> [--content <c>] [--rich-text <json>]` | Edit a reply you authored. |
| `gobi space delete-reply <replyId>` | Delete a reply you authored |

### Personal space (private posts)

Private posts and replies visible only to you. Same `Post` data model and subcommand shape as a Space Post, but scoped to a personal space — they never appear in any public feed.

| Command | Description |
|---------|-------------|
| `gobi personal feed` | Your personal-space feed (posts + replies, newest first) |
| `gobi personal list-posts` | List personal-space posts |
| `gobi personal get-post <postId> [--full]` | Get a personal-space post with its ancestors and replies |
| `gobi personal create-post [--title <t>] (--content <c> \| --rich-text <json>) [--artifact <artifactId>]… [--repost-post-id <id>] [--attach <file>]…` | Create a private post in your personal space. `--artifact` attaches an existing artifact to the post (repeatable). `--attach` works the same as on `gobi space create-post`. |
| `gobi personal edit-post <postId> [--title <t>] [--content <c>]` | Edit a personal-space post you authored |
| `gobi personal delete-post <postId>` | Delete a personal-space post you authored |
| `gobi personal create-reply <postId> (--content <c> \| --rich-text <json>) [--attach <file>]…` | Reply to a personal-space post (inherits the parent's private scope) |
| `gobi personal edit-reply <replyId> [--content <c>] [--rich-text <json>]` | Edit a reply you authored |
| `gobi personal delete-reply <replyId>` | Delete a reply you authored |

### Sense (activities & conversations)

Activity and conversation data captured by Gobi Sense (the wearable) and the mobile app, then ingested by the cloud pipeline. Read-only. See the `gobi-sense` skill for full workflows.

Like posts and artifacts, Sense data is **scoped to a space**: the subcommands live under `gobi personal …` (your personal space) and `gobi space …` (the active team space — `gobi space warp <slug>` or `gobi space --space-slug <slug> …`). `<scope>` below is `personal` or `space`.

- **activities** — what you were doing (category + details, start/end times). In a team space, every member's activities show up, attributed to their recorder.
- **conversations** — phone-mic Audio Logs plus Sense-detected conversations, each with a transcript and auto-generated summary. In a team space, every member's conversations show up, attributed to their recorder (transcript/audio stay owner-only). (This replaces the old `list-transcriptions` — transcriptions were unified into conversations.)

| Command | Description |
|---------|-------------|
| `gobi <scope> activities list [--limit N] [--before <cursor>] [--mine]` | List Sense activities in this scope (newest first) |
| `gobi <scope> activities get <activityId>` | Get one activity's details |
| `gobi <scope> activities transcript <activityId>` | Get an activity's transcript (owner-only) |
| `gobi <scope> conversations list [--limit N] [--before <cursor>] [--mine]` | List conversations captured in this scope (newest first) |
| `gobi <scope> conversations transcript <conversationId>` | Get a conversation's transcript and summary |
| `gobi <scope> conversations audio <conversationId>` | Get a signed URL for the recording (owner-only) |

`gobi space …` lists are a complete, fully-paginated per-space history (every member's records); add `--mine` to restrict either `list` to records you recorded. `gobi personal conversations list` is filtered from the cross-scope conversations feed, so it shows your recent personal conversations rather than a fully paginated history (`gobi personal activities list` is fully paginated).

### Artifacts

An *artifact* is a versioned, human-owned creation attached to posts. Kinds: `image | video | gif | markdown | meeting_summary`. Markdown kinds carry a body; media kinds carry an uploaded file. Revisions form a draft/published tree (at most one published per artifact). Markdown kinds store `metadata.vaultSlug` for `[[wikilink]]` resolution. See the `gobi-artifact` skill for full workflows.

Artifacts are **scoped to a space**: the subcommands live under `gobi personal artifact …` (your personal space) and `gobi space artifact …` (the active team space — `gobi space warp <slug>` or `gobi space --space-slug <slug> artifact …`). `<scope>` below is `personal` or `space`.

| Command | Description |
|---------|-------------|
| `gobi <scope> artifact list [--kind <k>] [--limit N]` | List this scope's artifacts (newest first) |
| `gobi <scope> artifact get <artifactId>` | Get one artifact with its current revision |
| `gobi <scope> artifact create --kind <k> [--file <path> \| --content <md>] [--title <t>] [--vault-slug <slug>] [--post-id <id>] [--auto-attachments] [--change-note <note>]` | Create an artifact in this scope. markdown/meeting_summary take a body via `--file`, `--content`, or stdin (`-`); image/gif/video upload `--file`. `--post-id` attaches it to a post (appends, doesn't clobber). `--auto-attachments` (markdown) uploads `[[wikilinks]]` to `--vault-slug`. |
| `gobi <scope> artifact revise <artifactId> [--file <path> \| --content <md>] [--change-note <note>] [--from <revisionId>] [--auto-attachments]` | Add a draft revision. `--from` branches off a specific revision. `--auto-attachments` reuses the artifact's stored `metadata.vaultSlug`. |
| `gobi <scope> artifact publish <artifactId> --revision <revisionId>` | Publish a revision (the artifact's single published revision) |
| `gobi <scope> artifact revert <artifactId> --to <revisionId>` | Move the published pointer to an earlier revision |
| `gobi <scope> artifact history <artifactId>` | List the full revision tree (owner only) |
| `gobi <scope> artifact download <artifactId> [--revision <revisionId>] [--out <path>]` | Download a revision's content (markdown body to file/stdout; media bytes to file). Defaults to the current revision. |
| `gobi <scope> artifact delete <artifactId>` | Delete an artifact and its revision tree |

Attach an artifact to a post at creation time with `gobi <scope> artifact create --post-id <postId>` (it merges into the post's existing artifacts without clobbering them).

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

### Top-level options

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
| `gobi-space` | `gobi space …` and `gobi personal …` |
| `gobi-artifact` | `gobi personal artifact …` and `gobi space artifact …` |
| `gobi-media` | `gobi media …` |
| `gobi-sense` | `gobi personal activities/conversations …` and `gobi space activities/conversations …` |
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

# gobi-cli

[![CI](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gobi-ai/cli)](https://www.npmjs.com/package/@gobi-ai/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

The programmatic interface to [Gobi](https://gobispace.com) — the agent-facing surface of the ecosystem. The same capabilities the desktop and web clients use (auth, community-space and personal posts and replies, artifacts, Sense activity and conversation reads) exposed as composable shell commands so AI agents and developer scripts can act on a user's behalf in Gobi.

## Why a CLI?

Most Gobi capabilities are interactive surfaces (Desktop, Web, Mobile). The CLI flips that: every command is scriptable, returns structured JSON when asked, and uses headless device-code auth so an agent can run it on any host. If you're building an agent that needs to work in a user's Gobi — post to a community space, version an artifact, read back Sense captures — this is the surface.

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

# Join a space you belong to, or create one — or skip: the personal core works alone
gobi space list
gobi space create --name "My Space" --slug "my-space"   # or: gobi space join <slug>

# Browse your personal core and create a private post
gobi personal feed
gobi personal create-post --title "Hello" --content "Trying gobi"

# Read back what Sense captured
gobi personal conversations list
```

The two things setup unlocks:

| Step | Unlocks |
|------|---------|
| `gobi auth login` | All authenticated commands |
| `gobi space warp <slug>` | Every `gobi space …` command without needing `--space-slug` |

---

## Using gobi from an agent

**Agents: read [AGENTS.md](AGENTS.md).** It is the canonical runbook — setting up a brand-new user (install → headless login → space), the `--json` envelope, context discovery, and reacting to notifications. The CLI was designed to be agent-driven first, and tools that follow the [agents.md](https://agents.md) convention load that file automatically when working in this repo.

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
| `gobi space list` | List spaces you are a member of |
| `gobi space warp [spaceSlug]` | Select the active space (interactive if slug omitted) |
| `gobi space create --name <n> --slug <s>` | Create a space and become its owner (warps you in) |
| `gobi space join <spaceSlug>` | Join an open space by slug (invite-only needs a web invite link) |

### Vault

| Command | Description |
|---------|-------------|
| `gobi vault init` | Select or create the vault for this directory. Writes `vaultSlug` to `.gobi/settings.yaml` and seeds `PUBLISH.md`. |
| `gobi vault list` | List vaults you own |
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
| `gobi space create-post [--title <t>] (--content <c> \| --rich-text <json>) [--artifact <artifactId>]… [--repost-post-id <id>] [--attach <file>]…` | Create a space post. Must provide content via `--content` or `--rich-text`. `--artifact` attaches an existing artifact to the post (repeatable). `--repost-post-id` reposts an existing post (sets `repostPostId` on the new post). `--attach` uploads local media and document files to render in-feed (repeatable; mix rule — up to 4 photos + 4 document files together, OR 1 GIF, OR 1 video). |
| `gobi space edit-post <postId> [--title <t>] [--content <c>]` | Edit a space post. |
| `gobi space delete-post <postId>` | Delete a space post |
| `gobi space create-reply <postId> (--content <c> \| --rich-text <json>) [--attach <file>]…` | Create a reply to a space post. `--attach` works the same as on `create-post`. |
| `gobi space edit-reply <replyId> [--content <c>] [--rich-text <json>]` | Edit a reply you authored. |
| `gobi space delete-reply <replyId>` | Delete a reply you authored |
| `gobi space list-dms` | List your DM conversations in the space (members and this space's bots). DMs never appear in `list-channels` or `feed`. |
| `gobi space open-dm [--user <userId>… \| --agent <botId> \| --agent-user <id>]` | Open (or create) a conversation and print its id. No flags opens the default space bot (id `bot`). `--agent <botId>` picks a space bot, or a registered personal bot when that botId is unique. Collision: pass `--agent-user` with the picker `id` from `space agents`. `--user` (repeatable) talks to members. `--user`, `--agent`, and `--agent-user` are mutually exclusive. Idempotent. |
| `gobi space send-dm <dmId> (--content <c> \| --rich-text <json>) [--attach <file>]…` | Send a message in a space DM. Mentions need `--rich-text`. |
| `gobi space dm-messages <dmId> [--limit N] [--cursor <c>]` | Read a space DM transcript (newest-first for paging). |
| `gobi space agents` | List this space's bots and registered personal bots (`id`, `botId`, name, `kind`, `ownerName`). |
| `gobi space agents add [--id <botId>] [--name <name>]` | Add a space bot. |
| `gobi space agents remove <botId>` | Remove a space bot. |

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
| `gobi personal list-dms` | List DM conversations in your personal core. You can DM your personal bots here. |
| `gobi personal open-dm [--agent <botId>]` | Open (or create) a conversation with a personal bot and print its id. Omit `--agent` for the default bot (id `bot`). Idempotent. |
| `gobi personal send-dm <dmId> (--content <c> \| --rich-text <json>) [--attach <file>]…` | Send a message to your personal agent. Same `--content` / `--rich-text` / `--attach` as `gobi space send-dm`. |
| `gobi personal dm-messages <dmId> [--limit N] [--cursor <c>]` | Read a personal-bot DM transcript (newest-first for paging). |
| `gobi personal agents` | List your personal bots (`botId`, name). |
| `gobi personal agents add [--id <botId>] [--name <name>]` | Add a personal bot. |
| `gobi personal agents remove <botId>` | Remove a personal bot. |

### Sense (activities & conversations)

Activity and conversation data captured by Gobi Sense (the wearable) and the mobile app, then ingested by the cloud pipeline. Read-only. See the `gobi-sense` skill for full workflows.

Sense data lives in your **personal core**: the subcommands live under `gobi personal …` only. There is no `gobi space activities` / `gobi space conversations` — every capture lands in your personal core whatever space was active at the time.

- **activities** — what you were doing (category + details, start/end times). Yours alone.
- **conversations** — phone-mic Audio Logs plus Sense-detected conversations, each with a transcript and auto-generated summary (transcript/audio stay owner-only). (This replaces the old `list-transcriptions` — transcriptions were unified into conversations.)

| Command | Description |
|---------|-------------|
| `gobi personal activities list [--limit N] [--before <cursor>] [--mine]` | List Sense activities (newest first) |
| `gobi personal activities get <activityId>` | Get one activity's details |
| `gobi personal activities transcript <activityId>` | Get an activity's transcript (owner-only) |
| `gobi personal conversations list` | List your conversations (newest first) |
| `gobi personal conversations transcript <conversationId>` | Get a conversation's transcript and summary |
| `gobi personal conversations audio <conversationId>` | Get a signed URL for the recording (owner-only) |

`gobi personal activities list` is fully paginated; `--mine` is a no-op (the lane is already all yours). `gobi personal conversations list` is filtered from the cross-scope conversations feed, so it shows your recent conversations rather than a fully paginated history, and takes no paging parameters.

### Notifications

The activity inbox on two axes — **scope** (`--space <slug>`, `--channel <id>`) and **filter** (`--type all|post|dm|capture`, `--unread`, `--mentions`).

| Command | Description |
|---------|-------------|
| `gobi notifications` (= `notifications list`) | List your inbox, newest first. Scope + filter flags as above; `--limit <n>` caps matching rows (default 30) |
| `gobi notifications listen` | Stream notifications live as NDJSON, headless (Ably). Same scope/filter flags. Pure live — nothing is replayed after a disconnect; run `list` to backfill |
| `gobi notifications read <id>` | Mark one notification read |
| `gobi notifications read --all [--space <slug>]` | Mark the whole scope read |

`--type capture` selects analyzer output landing from your captures (`capture_note`, `capture_activity`) — the headless way to watch a Sense day land.

### Artifacts

An *artifact* is a versioned, human-owned creation attached to posts. Kinds: `image | video | gif | markdown | note`. Markdown kinds (`markdown`, `note`) carry a body; media kinds carry an uploaded file. Revisions form a history tree whose newest node is what the artifact reads as. Markdown kinds store `metadata.vaultSlug` for `[[wikilink]]` resolution. See the `gobi-artifact` skill for full workflows.

Artifacts live in your **personal core**: the subcommands live under `gobi personal artifact …` only. There is no `gobi space artifact` — share one with a space by attaching it to a post.

| Command | Description |
|---------|-------------|
| `gobi personal artifact list [--kind <k>] [--limit N]` | List your artifacts (newest first) |
| `gobi personal artifact get <artifactId>` | Get one artifact with its current revision |
| `gobi personal artifact create --kind <k> [--file <path> \| --content <md>] [--title <t>] [--vault-slug <slug>] [--post-id <id>] [--auto-attachments] [--change-note <note>]` | Create an artifact in your personal core. markdown/note take a body via `--file`, `--content`, or stdin (`-`); image/gif/video upload `--file`. `--post-id` attaches it to a post (appends, doesn't clobber). `--auto-attachments` (markdown) uploads `[[wikilinks]]` to `--vault-slug`. |
| `gobi personal artifact revise <artifactId> [--file <path> \| --content <md>] [--change-note <note>] [--from <revisionId>] [--auto-attachments]` | Edit the artifact: records a revision and makes it the current one. `--from` branches off a specific revision. `--auto-attachments` reuses the artifact's stored `metadata.vaultSlug`. |
| `gobi personal artifact revert <artifactId> --to <revisionId>` | Restore an earlier revision's content as a new revision |
| `gobi personal artifact history <artifactId>` | List the full revision tree (owner only) |
| `gobi personal artifact download <artifactId> [--revision <revisionId>] [--out <path>]` | Download a revision's content (markdown body to file/stdout; media bytes to file). Defaults to the current revision. |
| `gobi personal artifact delete <artifactId>` | Delete an artifact and its revision tree |

Attach an artifact to a post at creation time with `gobi personal artifact create --post-id <postId>` (it merges into the post's existing artifacts without clobbering them).

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
| `gobi-artifact` | `gobi personal artifact …` |
| `gobi-sense` | `gobi personal activities/conversations …` |

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

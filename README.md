# gobi-cli

[![CI](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/gobi-ai/gobi-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gobi-ai/cli)](https://www.npmjs.com/package/@gobi-ai/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

The programmatic interface to [Gobi](https://gobispace.com) — the agent-facing surface of the ecosystem. The same capabilities the desktop and web clients use (auth, community-space and personal posts and replies, artifacts, notes and activities) exposed as composable shell commands so AI agents and developer scripts can act on a user's behalf in Gobi.

**Personal assistant agents (e.g. Muse): read [MUSE.md](MUSE.md). Coding agents: read [AGENTS.md](AGENTS.md).**

## Getting started with Muse

Meta Muse users can set up proactive Gobi automation: a morning snapshot plus daytime check-ins from your Sense notes and activities.

1. Install the CLI with Homebrew or npm (see [Installation](#installation)). Muse can also install it for you.
2. Send Muse this starter prompt:

   > Install the Gobi CLI (`npm install -g @gobi-ai/cli`), read MUSE.md at https://raw.githubusercontent.com/gobi-ai/gobi-cli/main/MUSE.md, log me in, and set up my Gobi automation.

3. Muse offers a daily snapshot at ~7:30am and check-ins at ~10am, 2pm, and 6pm. Say yes, and it creates the recurring tasks.
4. If Muse asks, approve them in Muse **Settings → Permissions → Artifacts and scheduled tasks**. They show under **Upcoming**.

Muse's instructions live in [MUSE.md](MUSE.md) and Muse reads them from `main`, so updates apply automatically. You don't need to change your prompt or reinstall anything.

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

# Or, with a one-time connect token from the Gobi app's "Connect with Gobi"
# prompt — no browser step, and it prints an onboarding brief for your agent.
# A token minted for a bot ("External agent → Connect an agent" — a space
# admin for a space bot, the owner for a personal bot) opens that bot's
# session instead: the agent runs headlessly AS the bot, and `auth status`
# shows an "Acting as:" line.
gobi auth login --token gbi_…

# Join a space you belong to, or create one — or skip: the personal core works alone
gobi space list
gobi space create --name "My Space" --slug "my-space"   # or: gobi space join <slug>

# Browse your personal core and create a private post
gobi personal posts recent
gobi personal posts create --title "Hello" --content "Trying gobi"

# Read back what you captured — your notes
gobi personal notes list
```

The two things setup unlocks:

| Step | Unlocks |
|------|---------|
| `gobi auth login` | All authenticated commands |
| `gobi space warp <slug>` | Every `gobi space …` command without needing `--space-slug` |

---

## Using gobi from an agent

**Personal assistant agents (e.g. Muse): read [MUSE.md](MUSE.md).** It is the ambient-assistant prompt — catch-up from **notes** and activities, Active Memory, evening debrief.

**Coding agents: read [AGENTS.md](AGENTS.md).** It is the canonical runbook — setting up a brand-new user (install → headless login → space), the `--json` envelope, context discovery, and reacting to notifications. Tools that follow the [agents.md](https://agents.md) convention load that file automatically when working in this repo.

## Commands

### Authentication

| Command | Description |
|---------|-------------|
| `gobi auth login` | Sign in via device-code flow. Pass `--token gbi_…` for a one-time connect token (no browser). |
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

> Inviting, approving, and leaving members is web-UI only. `gobi space create` and `gobi space join` are the onboarding exceptions.

| Command | Description |
|---------|-------------|
| `gobi space get [spaceSlug]` | Show space details (uses current space if slug omitted) |
| `gobi space posts recent [--feed <c…> \| --all-feeds]` | Unified feed (posts + replies, newest first). `--feed` reads one feed; `--all-feeds` reads the main feed plus every feed visible to you. |
| `gobi space posts search <query> [--feed <c…>]` | Search posts and replies (keywords, `from:<name>`). Each hit is one post or reply, not a thread. |
| `gobi space posts list [--feed <c…> \| --all-feeds]` | List posts in the space |
| `gobi space posts get <postId> [--full]` | Get a post with its ancestors and replies. `--full` shows reply content without truncation. |
| `gobi space posts create [--title <t>] (--content <c> \| --rich-text <json>) [--artifact <artifactId>]… [--repost-post-id <id>] [--attach <file>]… [--feed <c…>]` | Create a space post. Must provide content via `--content` or `--rich-text` (or an attachment). `--artifact` attaches an existing artifact (repeatable). `--repost-post-id` embeds an existing post. `--attach` uploads local media/docs (repeatable; up to 8). `--feed` posts into a named feed instead of the main feed. Space-bot writes should pass `--rationale`. |
| `gobi space posts reply <postId> (--content <c> \| --rich-text <json>) [--attach <file>]…` | Create a reply to a space post. `--attach` works the same as on `posts create`. |
| `gobi space posts edit <id> [--title <t>] [--content <c>]` | Edit a post (`p…`) or reply (`r…`) you authored. A reply takes no `--title`, `--attach` or `--artifact`. |
| `gobi space posts delete <id>` | Delete a post or reply you authored |
| `gobi space posts react <postId> <emoji>` | Add an emoji reaction (idempotent). |
| `gobi space posts unreact <postId> <emoji>` | Remove your emoji reaction. |
| `gobi space feeds list` | List the named feeds visible to you. The main feed is not listed. |
| `gobi space feeds get <feedId>` | Get one feed (`c…`). |
| `gobi space feeds members <feedId>` | List members of a feed. |
| `gobi space dms list` | List your DM conversations in the space (members and this space's bots). DMs never appear in `feeds list` or `posts recent`. |
| `gobi space dms open [--user <userId>… \| --agent <botId>]` | Open (or create) a conversation and print its id. No flags opens the space's own bot (its oldest, when it has several). `--agent <botId>` picks one of this space's bots. `--user` (repeatable) talks to members. `--user` and `--agent` are mutually exclusive. Idempotent. |
| `gobi space dms send <dmId> (--content <c> \| --rich-text <json>) [--attach <file>]…` | Send a message in a space DM. Mentions need `--rich-text`. |
| `gobi space dms messages <dmId> [--limit N] [--cursor <c>] [--session <p…>]` | Read a space DM transcript (newest-first for paging); the newest session unless `--session`. |
| `gobi space dms sessions <dmId>` | List a space DM's sessions, newest first. |
| `gobi space agents list` | List this space's bots (`id`, `botId`, name). |
| `gobi space agents add [--id <botId>] [--name <name>]` | Add a space bot. |
| `gobi space agents remove <botId>` | Remove a space bot. |

### Personal space (private posts)

Private posts and replies visible only to you. Same `Post` data model and subcommand shape as a Space Post, but scoped to a personal space — they never appear in any public feed.

| Command | Description |
|---------|-------------|
| `gobi personal posts recent` | Your personal-space feed (posts + replies, newest first). Not Sense captures — those are `gobi personal notes`. |
| `gobi personal posts search <query>` | Search personal-space posts and replies (keywords, `from:<name>`, ). |
| `gobi personal posts list` | List personal-space posts |
| `gobi personal posts get <postId> [--full]` | Get a personal-space post with its ancestors and replies |
| `gobi personal posts create [--title <t>] (--content <c> \| --rich-text <json>) [--artifact <artifactId>]… [--repost-post-id <id>] [--attach <file>]…` | Create a private post in your personal space. `--artifact` attaches an existing artifact to the post (repeatable). `--attach` works the same as on `gobi space posts create`. |
| `gobi personal posts reply <postId> (--content <c> \| --rich-text <json>) [--attach <file>]…` | Reply to a personal-space post (inherits the parent's private scope) |
| `gobi personal posts edit <id> [--title <t>] [--content <c>]` | Edit a post or reply you authored (`p…` / `r…`) |
| `gobi personal posts delete <id>` | Delete a post or reply you authored |
| `gobi personal feeds list` / `feeds get <feedId>` | Your personal space's named feeds. `--feed <c…>` on `posts recent` / `list` / `search` / `create` targets one; `--all-feeds` reads across them. |
| `gobi personal posts react <postId> <emoji>` | Add an emoji reaction (idempotent). |
| `gobi personal posts unreact <postId> <emoji>` | Remove your emoji reaction. |
| `gobi personal dms list` | List DM conversations in your personal core. You can DM your personal bots here. |
| `gobi personal dms open [--agent <botId>]` | Open (or create) a conversation with a personal bot and print its id. Omit `--agent` for your oldest bot. Idempotent. |
| `gobi personal dms send <dmId> (--content <c> \| --rich-text <json>) [--attach <file>]…` | Send a message to your personal agent. Same `--content` / `--rich-text` / `--attach` as `gobi space dms send`. |
| `gobi personal dms messages <dmId> [--limit N] [--cursor <c>]` | Read a personal-bot DM transcript (newest-first for paging). |
| `gobi personal agents list` | List your personal bots (`botId`, name). |
| `gobi personal agents add [--id <botId>] [--name <name>]` | Add a personal bot. |
| `gobi personal agents remove <botId>` | Remove a personal bot. |

### Notes & activities

**Notes and activities are records that belong to a lane** — your personal space or a space — and are never shared directly; sharing outside a lane is what **artifacts** are for (posted, emailed, or opened from a link). Read-only. See the `gobi-sense` skill for full workflows.

- **notes** — one captured moment turned into text: an audio log (phone, watch or desktop), a video log, a meeting, an imported recording, a conversation Sense detected, or a written note. Each has a title, a summary and, when there was speech, a transcript. Raw audio is not exposed.
- **activities** — what the wearer was doing over a stretch of time (category + details, start/end), detected by Sense.

| Command | Description |
|---------|-------------|
| `gobi personal context [--since <duration\|ISO>] [--limit N]` | Compact snapshot for assistant agents: current/latest activity, recent activities, recent notes (id, title, time, summary, speakers), and fresh capture notifications. `--since` defaults to 24h; `--limit` (default 5) caps each section. Composes the personal notes/activities list/get clients and `notifications list --type capture`. |
| `gobi personal notes list [--limit N] [--before <cursor>]` | Your personal space's notes, newest first: title, then what it was made from |
| `gobi personal notes get <noteId>` | Source, summary, side notes, shared artifact, and transcript |
| `gobi personal activities list [--limit N] [--before <cursor>]` | Your personal space's activities, newest first |
| `gobi personal activities get <activityId>` | One activity (visible if you recorded it) |
| `gobi space notes list [--limit N] [--before <cursor>] [--mine]` | A space's notes, attributed to each recorder. `--mine` keeps only ones you recorded. |
| `gobi space notes get <noteId>` | Same view as personal (recorder or a member of the note's space) |
| `gobi space activities list [--limit N] [--before <cursor>]` | A space's activities, newest first |

There is no `conversations` command group and no alias — use `notes`. (Backend HTTP paths may still say `/conversations`.)

### CLI updates

| Command | Description |
|---------|-------------|
| `gobi update [--check]` | Install the latest gobi-cli (`--check` reports only). Interactive; ignores `--json`. |

### Notifications

The activity inbox on two axes — **scope** (`--space <slug>`, `--feed <id>`) and **filter** (`--type all|post|dm|capture`, `--unread`, `--mentions`).

| Command | Description |
|---------|-------------|
| `gobi notifications` (= `notifications list`) | List your inbox, newest first. Scope + filter flags as above; `--limit <n>` caps matching rows (default 30) |
| `gobi notifications listen` | Stream notifications live as NDJSON, headless (Ably). Same scope/filter flags. Pure live — nothing is replayed after a disconnect; run `list` to backfill |
| `gobi notifications read <id>` | Mark one notification read |
| `gobi notifications read --all [--space <slug>]` | Mark the whole scope read |

`--type capture` selects analyzer output landing from your captures (`capture_note`, `capture_activity`) — the headless way to watch a Sense day land.

### Artifacts

An *artifact* is a versioned, human-owned creation attached to posts. Kinds: `image | video | gif | markdown | note | html`. Text kinds (`markdown`, `note`, `html`) carry a body; media kinds carry an uploaded file. Revisions form a history tree whose newest node is what the artifact reads as. Markdown kinds store `metadata.vaultSlug` for `[[wikilink]]` resolution. See the `gobi-artifact` skill for full workflows.

Artifacts belong to a lane: your **personal core** (`gobi personal artifacts …`) or a **space** (`gobi space artifacts …`, every member sees the space's set). The same subcommands exist under both; only `create` and `list` take the scope (`gobi space artifacts create|list` also accept `--space-slug`). Share one into a feed by attaching it to a post.

| Command | Description |
|---------|-------------|
| `gobi personal artifacts list [--kind <k>] [--limit N]` | List your artifacts (newest first) |
| `gobi personal artifacts get <artifactId>` | Get one artifact with its current revision |
| `gobi personal artifacts create --kind <k> [--file <path> \| --content <body>] [--title <t>] [--vault-slug <slug>] [--post-id <id>] [--auto-attachments] [--change-note <note>]` | Create an artifact in your personal core. markdown/note/html take a body via `--file`, `--content`, or stdin (`-`); image/gif/video upload `--file`. `--post-id` attaches it to a post (appends, doesn't clobber). `--auto-attachments` (markdown) uploads `[[wikilinks]]` to `--vault-slug`. |
| `gobi personal artifacts revise <artifactId> [--file <path> \| --content <body>] [--change-note <note>] [--from <revisionId>] [--auto-attachments]` | Edit the artifact: records a revision and makes it the current one. `--from` branches off a specific revision. `--auto-attachments` reuses the artifact's stored `metadata.vaultSlug`. |
| `gobi personal artifacts revert <artifactId> --to <revisionId>` | Restore an earlier revision's content as a new revision |
| `gobi personal artifacts history <artifactId>` | List the full revision tree (owner only) |
| `gobi personal artifacts download <artifactId> [--revision <revisionId>] [--out <path>]` | Download a revision's content (markdown/note/html body to file/stdout; media bytes to file). Defaults to the current revision. |
| `gobi personal artifacts delete <artifactId>` | Delete an artifact and its revision tree |

Attach an artifact to a post at creation time with `gobi personal artifacts create --post-id <postId>` (it merges into the post's existing artifacts without clobbering them).

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
| `GOBI_SCENARIO` | (unset) | Optional webdrive `AgentScenario.flow` forwarded as `x-gobi-scenario` (`observe`, `space-routine`, `space-context-refresh`, …). Leave unset for terminal `gobi` (counted). See [docs/cli-scenario.md](docs/cli-scenario.md). |
| `ANTHROPIC_CUSTOM_HEADERS` | (unset) | Fallback source for `x-gobi-scenario` until webdrive also exports `GOBI_SCENARIO`. gobi-cli reads the `x-gobi-scenario:` line. |

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
| `gobi-artifact` | `gobi personal artifacts …` |
| `gobi-sense` | `gobi personal notes/activities …` and `gobi space notes/activities …` |

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

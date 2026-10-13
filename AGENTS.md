# gobi-cli — agent guide

You're an agent (a Grok Bot, a Claude Code session, any assistant with a shell) asked to set up or use **gobi-cli**, the programmatic interface to [Gobi](https://gobispace.com). This file is the canonical **coding-agent** runbook. Daily personal assistants (Muse and the like) should follow [MUSE.md](MUSE.md) instead. The [README](README.md) holds the human-facing docs and the full flag reference.

## Connecting with a token

If the user handed you a prompt like this (the Gobi app and web show it during onboarding):

```
Connect with Gobi
GitHub: https://github.com/gobi-ai/gobi-cli
Token: gbi_…
```

install (step 1 below), then log in with the token — no browser approval step:

```sh
gobi auth login --token gbi_…
```

On success it prints an onboarding brief addressed to YOU: learn Gobi from this file, look around the user's Gobi with read-only commands, then report back — briefly say what you found, ask only the questions you need answered, and end with exactly: *I'm connected with Gobi and I'm ready.* Follow it, skipping steps 2–3 below (the token replaces the browser login, and the brief replaces the explain-Gobi script — you're the one learning Gobi here, so don't lecture the user about it).

Tokens are single-use and expire after 24 hours; if the login says the token was rejected, ask the user to copy a fresh prompt from the app.

### When the token is a bot's

A space admin can mint a token for one of their space's bots, and a person can mint one for one of their own personal bots (Gobi app → the bot's settings → **External agent → Connect an agent**). The same `gobi auth login --token` redeems it, but the session then **is** that bot: every post, reply, and reaction appears under the bot's name, and `gobi auth status` says so on an `Acting as:` line (`bot "<botId>" of space <slug>`, or `personal bot "<botId>" of <owner>`). The brief you get is the headless one — nobody is on the other end of the session, so it asks no questions and reports back to no one.

- **Space bot** — work from the space feed (where a mention of the bot shows up) and `gobi notifications list` (where a DM to the bot lands), answer as the bot, and keep watching.
- **Personal bot** — it serves its owner alone. Work from `gobi personal feed` (the owner's posts) and `gobi personal list-dms` / `gobi notifications list` (where a DM to the bot lands), answer with `gobi personal create-reply` / `gobi personal send-dm`, and keep watching.

When you post as a space bot, add `--rationale "<why>"` to `gobi space create-post` / `gobi space create-reply` / `gobi space send-dm`: one to three sentences on what prompted the post. It is stored with the post but not shown in it — only the space's admins read it — so it is how they can tell why their bot said what it said.

## Setting up a new user

Run this once, in order. Every step is a real command — run it and read what it says.

**1. Install** (skip if already present):

```sh
gobi --version 2>/dev/null || npm install -g @gobi-ai/cli   # or: brew install gobi-ai/tap/gobi
```

**2. Log in — relay the link, then wait.** `gobi auth login` prints a URL + user code and blocks, polling, until the user approves in their browser. (Given a connect token, use `gobi auth login --token <token>` instead — see [Connecting with a token](#connecting-with-a-token).) Relay the URL to the user, ask them to approve, and let the command return on its own (don't kill it). Then confirm:

```sh
gobi auth login          # blocks — relay the printed URL to the user
gobi --json auth status  # → {"data":{"authenticated":true, ...}}
```

**3. Explain Gobi** (say this, briefly): *Gobi is a shared knowledge space. What you capture — from the Sense wearable, phone, or desktop — becomes **notes** and **activities**, records kept in the lane they were captured into: your private **personal space**, or a **space** (a shared feed with channels and DMs, where you talk with people and agents). To share something beyond its lane, you make it an **artifact** — posted, emailed, or opened from a link.*

**4. Set up a space.** Check what they're in then branch:

```sh
gobi --json space list
```

- **Already in a space** → tell them (name + slug), optionally `gobi space warp <slug>`. Done.
- **None — want to join one?** Ask for the slug, then `gobi space join <slug>` (open spaces only; an invite-only space says so — they join it via its invite link in the app/web instead).
- **None — want to create one?** `gobi space create --name "<name>" --slug "<slug>"`. They become the owner and are warped in.
- **Neither** → the personal core works alone: `gobi personal notes list`, `gobi personal feed`, `gobi personal open-dm`, etc. They can `gobi space create` / `gobi space join` any time later.

**5. Adding teammates needs the app.** The CLI creates and joins spaces, but **inviting other people** (and member/settings admin) happens in the Gobi app or web. To bring your team: install the app, open the space, and share its invite link.

- iOS: <https://apps.apple.com/app/id6477150074>
- Android: <https://play.google.com/store/apps/details?id=com.joingobi>
- Web: <https://gobispace.com>

That's the whole setup: log in, pick (or skip) a space. Stick to the commands named on this page while onboarding; the [command index](#command-index) and the [README command reference](README.md#commands) cover the rest.

## Using the CLI

### JSON envelope

Pass `--json` as a **top-level flag** (before the subcommand) and every command returns a structured envelope:

```sh
gobi --json space list-posts
# {"success": true, "data": [...]}

gobi --json space get-post p0000000000
# {"success": false, "error": "Post not found"}
```

`success: true` always carries `data`; `success: false` always carries `error`. Pagination metadata (`pagination: { hasMore, nextCursor }`) ships alongside `data` on list endpoints. Skill docs and the `--help` output describe each command's `data` shape. Interactive commands (`gobi auth login`, `gobi vault init`, `gobi update`, `gobi space warp` without a slug) ignore `--json`.

### Context discovery

The CLI looks up two pieces of state:

| Path | What | Who manages |
|------|------|-------------|
| `~/.gobi/credentials.json` | Auth tokens (`accessToken`, `refreshToken`) | `gobi auth login` writes; `gobi auth logout` clears |
| `.gobi/settings.yaml` | Per-project `selectedSpaceSlug` (and optional `vaultSlug`) | `gobi space warp` / `gobi vault init` write |

Check these before calling commands that need a space:

```sh
# Are we authenticated?
gobi --json auth status

# Discover the project's defaults
cat .gobi/settings.yaml 2>/dev/null
```

If `.gobi/settings.yaml` has no space, `gobi space warp` sets one — interactive when run with no slug, so hand off to the user (or pass a slug to set it directly).

`gobi space …` commands accept `--space-slug <slug>` (on the parent group or any subcommand) to override the default space.

### Notes and activities (not `conversations`)

Sense captures land as **notes** and **activities**. The CLI command is `notes`. There is **no** `conversations` command group and **no alias** — `src/cli.test.ts` asserts unknown-command if you try. (HTTP paths still say `/app/conversations`; that is the backend, not the CLI.)

| Lane | Notes | Activities |
|------|-------|------------|
| Personal | `gobi personal notes list` / `gobi personal notes get` | `gobi personal activities list` / `gobi personal activities get` |
| Space | `gobi space notes list` / `gobi space notes get` | `gobi space activities list` (no per-id `get`) |

A note id is `o…`; an activity id is `v…`. `notes get` returns source, summary, side notes, optional shared artifact, and diarized transcript turns (`speaker` / `speakerLabel`). Raw audio is never exposed. Records stay in their lane; sharing outside a lane is what **artifacts** are for (`gobi personal artifact …` only — there is no `gobi space artifact`).

### Direct messages

Two scopes, different counterparties:

- **Personal** — `gobi personal open-dm` / `gobi personal list-dms` / `gobi personal send-dm` / `gobi personal dm-messages`. Omit `--agent` for the user's oldest personal bot. `gobi personal agents` lists bots.
- **Space** — `gobi space open-dm` opens the space's own bot — its oldest, when it has several; a space with no bot has none to open. `--agent <botId>` picks one of this space's bots. `--user <publicId>` (repeatable) talks to members. `--user` and `--agent` are mutually exclusive. `gobi space agents` lists this space's bots (publicId `u…` on every row). `gobi space dm-sessions` lists sessions; `gobi space dm-messages` accepts `--session`. A personal bot is its owner's alone — it is never a party to a space.

### Headless auth

`gobi auth login` is a device-code flow: it prints a URL and a user code to stdout, then polls. Run it as a background task, surface the URL to the user as a clickable link, and wait for the process to exit. See [`commands/login.md`](commands/login.md) for the canonical recipe.

### Reacting to activity

`gobi notifications listen` streams the user's inbox live as NDJSON, headless — one JSON object per line, same scope/filter flags as `gobi notifications list` (`--space`, `--channel`, `--type all|post|dm|capture`, `--unread`, `--mentions`). Pure live: nothing is replayed after a disconnect; run `gobi notifications list` to backfill. `--type capture` is freshly landed Sense analyzer output (`capture_note`, `capture_activity`).

### Mutating commands

Confirm with the user before any of: `gobi space create-post`, `gobi space edit-post`, `gobi space delete-post`, `gobi space create-reply`, `gobi space edit-reply`, `gobi space delete-reply`, `gobi space react`, `gobi space unreact`, `gobi space send-dm`, `gobi space create`, `gobi space join`, `gobi space agents add`, `gobi space agents remove`, and the same post/reply/react/DM/agent writes under `gobi personal`; plus `gobi personal artifact create`, `gobi personal artifact revise`, `gobi personal artifact revert`, `gobi personal artifact delete`, `gobi vault init`, `gobi vault create`, `gobi vault rename`, `gobi vault delete`, `gobi vault publish`, `gobi vault unpublish`, `gobi vault sync`, `gobi notifications read`, `gobi auth logout`, `gobi update`.

## Command index

<!-- GENERATED-COMMAND-INDEX:START -->

Generated from `gobi --help` by `npm run generate-skill-docs`. Do not edit by hand.

### `gobi auth`

- `gobi auth` — Authentication commands.
- `gobi auth login` — Log in to Gobi.
- `gobi auth status` — Check whether you are currently authenticated with Gobi.
- `gobi auth logout` — Log out of Gobi and remove stored credentials.

### `gobi notifications`

- `gobi notifications` — Your activity inbox: list (default), listen, read.
- `gobi notifications list` — List activity notifications.
- `gobi notifications listen` — Stream notifications live as they arrive (headless, no browser).
- `gobi notifications read` — Mark notifications read: `read <id>` for one, or `read --all` (optionally --space) for the whole scope.

### `gobi space`

- `gobi space` — Space commands (posts, replies).
- `gobi space list` — List spaces you are a member of.
- `gobi space get` — Get details for a space.
- `gobi space warp` — Select the active space.
- `gobi space create` — Create a new space and become its owner.
- `gobi space join` — Join an OPEN space by slug.
- `gobi space list-topics` — List topics in a space, ordered by most recent content linkage.
- `gobi space list-topic-posts` — List posts tagged with a topic in a space (cursor-paginated).
- `gobi space feed` — List the unified feed (posts and replies, newest first) in a space.
- `gobi space search-posts` — Search a space's posts and replies (newest first).
- `gobi space get-post` — Get a post with its ancestors and replies (paginated).
- `gobi space list-posts` — List posts in a space (paginated).
- `gobi space create-post` — Create a post in a space.
- `gobi space edit-post` — Edit a post you authored in a space.
- `gobi space delete-post` — Delete a post you authored in a space.
- `gobi space create-reply` — Create a reply to a post in a space.
- `gobi space edit-reply` — Edit a reply you authored in a space.
- `gobi space delete-reply` — Delete a reply you authored in a space.
- `gobi space react` — Add an emoji reaction to a post or reply (idempotent).
- `gobi space unreact` — Remove your emoji reaction from a post or reply.
- `gobi space list-channels` — List channels visible to you in a space (members: yours; space owner/admin: all).
- `gobi space get-channel` — Get one channel (channel members, space owner/admin, or the agent on agent-enabled channels).
- `gobi space list-channel-members` — List the members of a channel.
- `gobi space list-dms` — List your direct-message conversations in a space, most recent first.
- `gobi space open-dm` — Open (or create) a conversation and print its id.
- `gobi space send-dm` — Send a message to a conversation (see `open-dm` / `list-dms`).
- `gobi space dm-messages` — Read a conversation's transcript.
- `gobi space dm-sessions` — List a conversation's sessions, newest first (id, started, last activity, preview).
- `gobi space agents` — List this space's bots (id, botId, name).
- `gobi space agents add` — Add a space bot.
- `gobi space agents remove` — Remove a space bot.
- `gobi space notes` — The space's notes — every member's, attributed to each recorder.
- `gobi space notes list` — List the space's notes, newest first — every audio log, video log, meeting, imported recording, Sense-detected conversation and written note.
- `gobi space notes get` — Get a note: what it was made from, its summary, side notes, transcript, and the artifact it was shared as (if any).
- `gobi space activities` — The space's activities — what members were doing over a stretch of time (traveling, working, talking…), detected by Sense while capturing into this space.
- `gobi space activities list` — List the space's activities (newest first).

### `gobi personal`

- `gobi personal` — Personal-space commands (private posts, replies, and DMs with your personal bots).
- `gobi personal feed` — List your personal-space feed (posts and replies, newest first).
- `gobi personal search-posts` — Search your personal-space posts and replies (newest first).
- `gobi personal list-posts` — List root posts (no replies) in your personal space.
- `gobi personal get-post` — Get a personal-space post with its ancestors and replies (paginated).
- `gobi personal create-post` — Create a private post in your personal space.
- `gobi personal edit-post` — Edit a post you authored in your personal space.
- `gobi personal delete-post` — Delete a post you authored in your personal space.
- `gobi personal create-reply` — Reply to a personal-space post.
- `gobi personal edit-reply` — Edit a reply you authored in your personal space.
- `gobi personal delete-reply` — Delete a reply you authored in your personal space.
- `gobi personal react` — Add an emoji reaction to a personal-space post or reply (idempotent).
- `gobi personal unreact` — Remove your emoji reaction from a personal-space post or reply.
- `gobi personal list-dms` — List your direct-message conversations in the personal core, most recent first.
- `gobi personal open-dm` — Open (or create) a conversation with a personal bot and print its id.
- `gobi personal send-dm` — Send a message to a conversation (see `open-dm` / `list-dms`).
- `gobi personal dm-messages` — Read a conversation's transcript.
- `gobi personal agents` — List your personal bots (botId, name).
- `gobi personal agents add` — Add a personal bot.
- `gobi personal agents remove` — Remove a personal bot.
- `gobi personal artifact` — Artifacts are for SHARING outside a lane: a versioned document or media item made for an audience — posted to a space or the feed, emailed, or opened from a link.
- `gobi personal artifact create` — Create an artifact.
- `gobi personal artifact revise` — Edit an artifact: records a revision and makes it the current one.
- `gobi personal artifact revert` — Restore an earlier revision's content as a new revision, which becomes the current one.
- `gobi personal artifact history` — List the artifact's full revision tree (owner only).
- `gobi personal artifact download` — Download an artifact's content.
- `gobi personal artifact delete` — Delete an artifact (and its revision tree).
- `gobi personal artifact get` — Get one artifact with its current revision.
- `gobi personal artifact list` — List this scope's artifacts (newest first).
- `gobi personal activities` — Your personal space's activities: what you were doing over a stretch of time (traveling, working, talking…), detected by Sense.
- `gobi personal activities list` — List the personal space's activities (newest first).
- `gobi personal activities get` — Get one activity's details (visible if you recorded it).
- `gobi personal notes` — Your personal space's notes.
- `gobi personal notes list` — List the personal space's notes, newest first — every audio log, video log, meeting, imported recording, Sense-detected conversation and written note.
- `gobi personal notes get` — Get a note: what it was made from, its summary, side notes, transcript, and the artifact it was shared as (if any).

### `gobi vault`

- `gobi vault` — Vault commands (init, list, publish/unpublish profile, sync files).
- `gobi vault init` — Select or create the vault for the current directory.
- `gobi vault create` — Create a new vault.
- `gobi vault rename` — Rename a vault.
- `gobi vault delete` — Delete a vault.
- `gobi vault list` — List vaults you own.
- `gobi vault status` — Show the configured vault's publish state and metadata (use before authoring a markdown artifact with --auto-attachments to confirm the vault is public).
- `gobi vault publish` — Upload PUBLISH.md to the vault root on webdrive.
- `gobi vault unpublish` — Delete PUBLISH.md from the vault on webdrive.
- `gobi vault sync` — Sync local vault files with Gobi Webdrive.

### `gobi update`

- `gobi update` — Update gobi-cli to the latest version.

<!-- GENERATED-COMMAND-INDEX:END -->

## Contributing

```sh
npm install
npm run build
npm test                      # builds first; tests run against dist/*.test.js
npm run generate-skill-docs   # after changing --help text or this file's command mentions
npm run dev -- auth status    # run from source without compiling
```

Node >= 18. TypeScript strict (`tsconfig.json`). Match the file you edit: existing sources use double quotes and semicolons. CI (`.github/workflows/ci.yml`) builds and tests on Node 18/20/22 and fails if generated skill docs or the command tables in this file / [MUSE.md](MUSE.md) drift from `--help`. Do not commit `~/.gobi/credentials.json` or tokens.

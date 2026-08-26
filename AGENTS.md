# gobi-cli — agent guide

You're an agent (a Grok Bot, a Claude Code session, any assistant with a shell) asked to set up or use **gobi-cli**, the programmatic interface to [Gobi](https://gobispace.com). This file is the canonical runbook. The [README](README.md) holds the human-facing docs and the full command reference.

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

**3. Explain Gobi** (say this, briefly): *Gobi is a shared knowledge space. You capture conversations and notes (from the Sense wearable, phone, or desktop), and talk with people and agents in **spaces** — shared feeds with channels and DMs. Everything you capture also lands in your private **personal core** (Home), yours alone.*

**4. Set up a space.** Check what they're in, then branch:

```sh
gobi --json space list
```

- **Already in a space** → tell them (name + slug), optionally `gobi space warp <slug>`. Done.
- **None — want to join one?** Ask for the slug, then `gobi space join <slug>` (open spaces only; an invite-only space says so — they join it via its invite link in the app/web instead).
- **None — want to create one?** `gobi space create --name "<name>" --slug "<slug>"`. They become the owner and are warped in.
- **Neither** → the personal core works alone: `gobi personal conversations list`, `gobi personal feed`, `gobi personal open-dm`, etc. They can `gobi space create` / `join` any time later.

**5. Adding teammates needs the app.** The CLI creates and joins spaces, but **inviting other people** (and member/settings admin) happens in the Gobi app or web. To bring your team: install the app, open the space, and share its invite link.

- iOS: <https://apps.apple.com/app/id6477150074>
- Android: <https://play.google.com/store/apps/details?id=com.joingobi>
- Web: <https://gobispace.com>

That's the whole setup: log in, pick (or skip) a space. Stick to the commands named on this page while onboarding; the [README command reference](README.md#commands) covers the rest of the surface when a task later calls for it.

## Using the CLI

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
| `.gobi/settings.yaml` | Per-project `selectedSpaceSlug` | `gobi space warp` writes |

Check these before calling commands that need a space:

```sh
# Are we authenticated?
gobi --json auth status

# Discover the project's defaults
cat .gobi/settings.yaml 2>/dev/null
```

If `.gobi/settings.yaml` has no space, `gobi space warp` sets one — interactive when run with no slug, so hand off to the user (or pass a slug to set it directly).

`gobi space …` commands accept `--space-slug <slug>` (on the parent group or any subcommand) to override the default space.

### Direct messages

Two scopes, different counterparties:

- **Personal** — `gobi personal open-dm [--agent <botId>]` / `list-dms` / `send-dm` / `dm-messages`. Omit `--agent` for the default personal bot (id `bot`). `gobi personal agents` lists bots.
- **Space** — `gobi space open-dm` opens the default space bot (id `bot`). `--agent <botId>` picks a space bot, or a registered personal bot when that botId is unique in the space. Collision errors; pass `--agent-user` with the picker publicId (`u…`) from `gobi space agents` (or `gobi --json space agents`). `--user <publicId>` (repeatable) talks to members. `--user`, `--agent`, and `--agent-user` are mutually exclusive. `bot` / `space` stay reserved for the house bot — a personal default bot with botId `bot` MUST use `--agent-user`. `gobi space agents` lists this space's bots and registered personal bots (publicId `u…` on every row).

### Headless auth

`gobi auth login` is a device-code flow: it prints a URL and a user code to stdout, then polls. Run it as a background task, surface the URL to the user as a clickable link, and wait for the process to exit. See [`commands/login.md`](commands/login.md) for the canonical recipe.

### Reacting to activity

`gobi notifications listen` streams the user's inbox live as NDJSON, headless — one JSON object per line, same scope/filter flags as `gobi notifications list` (`--space`, `--channel`, `--type all|post|dm|capture`, `--unread`, `--mentions`). Pure live: nothing is replayed after a disconnect; run `list` to backfill. This is how an agent notices a mention, a DM, or freshly landed capture output and responds.

---
name: gobi-saved
description: >-
  Gobi saved commands for the user's personal saved-knowledge collection:
  saved notes (create/list/get/edit/delete) and saved posts (snapshot a
  post/reply you bookmarked from feed/space; list/get/delete). Use when the
  user wants to capture their own notes or bookmark/manage posts they've
  saved.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.0"
---

# gobi-saved

Gobi saved-knowledge commands (v2.0.0).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## What is "saved"?

`gobi saved` is the user's personal saved-knowledge collection. It has two subgroups:

- **`gobi saved note`** — User-authored notes (private, dated entries).
- **`gobi saved post`** — Snapshots of posts (or replies) that the user has bookmarked from a space or the global feed.

Both are user-private — only the author can see/edit/delete their own items.

## Timezone

`gobi saved note list` and `gobi saved note create` need a timezone to compute the calendar day. The CLI auto-detects your system timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Override with `--timezone <iana-name>` (e.g. `America/Los_Angeles`).

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json saved note list --date 2026-04-27
```

## Available Commands

### Notes
- `gobi saved note list` — List your notes. Without `--date`, returns recent notes via cursor pagination. With `--date YYYY-MM-DD`, returns all notes for that day.
- `gobi saved note get <noteId>` — Get a single note by id.
- `gobi saved note create --content <md>` — Create a note. Use `'-'` for stdin.
- `gobi saved note edit <noteId>` — Edit a note. Provide `--content` and/or `--agent-id`.
- `gobi saved note delete <noteId>` — Delete a note you authored.

### Posts
- `gobi saved post list` — List posts you have saved (paginated). Filter with `--type all|article|space-post`.
- `gobi saved post get <postId>` — Get a saved post snapshot by post id.
- `gobi saved post create --source <id>` — Save a post or reply by id. Records a snapshot in your saved-posts collection.
- `gobi saved post delete <postId>` — Remove a post from your saved-posts collection.

## Reference Documentation

- [gobi saved](references/saved.md)

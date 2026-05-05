---
name: gobi-saved
description: >-
  Gobi saved commands for the user's personal saved-knowledge collection:
  notes (list/get/create/edit/delete) and bookmarked posts (snapshot a
  post/reply from feed/space; list/get/delete). Use when the user wants to
  capture their own notes or bookmark/manage posts they've saved.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.5"
---

# gobi-saved

Gobi saved-knowledge commands (v2.0.5).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## What is "saved"?

`gobi saved` is the user's personal saved-knowledge collection. It covers two kinds of items:

- **Notes** — user-authored notes (private, dated entries). Verbs: `list-notes`, `get-note`, `create-note`, `edit-note`, `delete-note`.
- **Posts** — snapshots of posts (or replies) bookmarked from a space or the global feed. Verbs: `list-posts`, `get-post`, `create-post`, `delete-post`.

Both are user-private — only the author can see/edit/delete their own items.

> Naming note: `gobi saved create-post --source <id>` is a **bookmark** operation — it saves an existing post into your collection. It does *not* author a new post (use `gobi global create-post` or `gobi space create-post` for that).

## Timezone

`gobi saved list-notes` and `gobi saved create-note` need a timezone to compute the calendar day. The CLI auto-detects your system timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Override with `--timezone <iana-name>` (e.g. `America/Los_Angeles`).

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json saved list-notes --date 2026-04-27
```

## Available Commands

### Notes
- `gobi saved list-notes` — List your notes. Without `--date`, returns recent notes via cursor pagination. With `--date YYYY-MM-DD`, returns all notes for that day.
- `gobi saved get-note <noteId>` — Get a single note by id.
- `gobi saved create-note --content <md>` — Create a note. Use `'-'` for stdin.
- `gobi saved edit-note <noteId>` — Edit a note. Provide `--content` and/or `--agent-id`.
- `gobi saved delete-note <noteId>` — Delete a note you authored.

### Posts (bookmarks)
- `gobi saved list-posts` — List posts you have bookmarked (paginated). Filter with `--type all|article|space-post`.
- `gobi saved get-post <postId>` — Get a saved post snapshot by post id.
- `gobi saved create-post --source <id>` — Bookmark a post or reply by id. Records a snapshot in your saved-posts collection.
- `gobi saved delete-post <postId>` — Remove a post from your saved-posts collection.

## Confirm before mutating

Saved items are the user's private collection but they still persist server-side and deletes are irreversible. Before running any write, confirm with the user — show the command and the note content / target id. This applies even when running autonomously.

- `create-note`, `edit-note` — confirm the content (or content delta on edit).
- `create-post` (bookmarking a feed post) — confirm the source id you're about to bookmark.
- `delete-note`, `delete-post` — irreversible. Flag that explicitly and confirm the target id before running.

Read-only commands (`list-notes`, `get-note`, `list-posts`, `get-post`) run without confirmation.

## Reference Documentation

- [gobi saved](references/saved.md)

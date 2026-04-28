---
name: gobi-notes
description: >-
  Gobi notes commands for personal note-taking: create, list (by day or
  cursor), get, edit, and delete notes. Notes are private, dated entries
  optionally tied to an agent. Use when the user wants to capture, review,
  or modify their own notes.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "1.3.2"
---

# gobi-notes

Gobi notes commands for personal note-taking (v1.3.2).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## What is a note?

A note is a private, dated entry you keep for yourself. Each note has:
- **content** — markdown text (optional if attachments are present, but the CLI requires `--content` since it doesn't yet upload attachments)
- **eventDate** — derived from your timezone at create time, used to group notes by day
- **agentId** — optional association with a Gobi agent

Notes are user-private — only you can see, edit, or delete your own notes.

## Timezone

`gobi notes list` and `gobi notes create` need a timezone to compute the calendar day. The CLI auto-detects your system timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Override with `--timezone <iana-name>` (e.g. `America/Los_Angeles`).

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json notes list --date 2026-04-27
```

## Available Commands

- `gobi notes` — Personal notes (create, list, get, edit, delete).
  - `gobi notes list` — List your notes. Without --date, returns recent notes via cursor pagination. With --date, returns all notes for that day.
  - `gobi notes get` — Get a single note by id.
  - `gobi notes create` — Create a note. Provide --content (use '-' for stdin) and/or attachments.
  - `gobi notes edit` — Edit a note. Provide --content and/or --agent-id.
  - `gobi notes delete` — Delete a note you authored.

## Reference Documentation

- [gobi notes](references/notes.md)

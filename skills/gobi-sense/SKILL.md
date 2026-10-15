---
name: gobi-sense
description: >-
  Gobi notes and activities — the records a lane keeps. A NOTE is one captured
  moment turned into text: an audio log, a video log, a meeting, an imported
  recording, a conversation Sense detected, or a written note. An ACTIVITY is
  what the wearer was doing over a stretch of time, detected by Sense. Both
  belong to the lane they were captured into — your personal space
  (`gobi personal notes|activities …`) or a space (`gobi space notes|activities …`)
  — and are never shared directly; sharing outside a lane is what artifacts are
  for. Read-only. Use when the user wants to review what they recorded or did.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.6.1"
---

# gobi-sense

Gobi notes and activities (v2.6.1).

Requires gobi-cli installed and authenticated. See the **gobi-core** skill for setup.

## Records and artifacts

**Notes and activities are records. They belong to a lane: your personal space, or a space.**

- A **note** is one captured moment turned into text. It is made from an **audio log** (phone, watch or desktop), a **video log**, a **meeting**, an **imported recording**, a **conversation Sense detected**, or a **written note**. Every note has a title, a summary and, when there was speech, a transcript.
- An **activity** is what the wearer was doing over a stretch of time (traveling, working, talking…), detected by Sense.
- Each record belongs to the lane it was captured into and **stays there**. A note or activity is never shared directly.

**Artifacts are for sharing outside the lane.** An artifact is a versioned document or media item made for an audience — posted to a space or the feed, emailed, or opened from a link. A note is shared by making it an artifact; `notes get` shows **Shared as artifact** when it has been. See the **gobi-artifact** skill.

## Two lanes

- **`gobi personal notes|activities …`** — your personal space.
- **`gobi space notes|activities …`** — a space: every member's records, notes attributed to each recorder.

## Reading a note

`notes get <noteId>` returns, in one view:

- **source** — what the note was made from (audio log, video log, meeting, imported audio, Sense, written note). `--json` keeps the stored `source` and adds `sourceLabel`.
- **summary** — the AI-generated note body.
- **side notes** — what the person wrote while recording (absent when none).
- **shared as artifact** — present only once the note has been shared out of its lane.
- **transcript** — the diarized turns, speakers resolved to names.

A note is readable by its recorder or a member of its space; an agent reads as the person it acts for. Raw **audio is never exposed**.

`notes list` is for people: an agent opens a note by its id (from a post, a mention, or an attachment).

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **top-level** option (before the subcommand):

```bash
gobi --json personal context
gobi --json personal notes list
gobi --json personal notes get o0123456789
gobi --json space notes list --space-slug acme
```

JSON mode wraps the response as `{"success": true, "data": <…>}` (or `{"success": false, "error": "…"}`), and preserves raw fields (e.g. the summary's markdown frontmatter) that the human view trims.

## Typical workflow

```bash
# compact snapshot (start here for now / recent-life questions)
gobi --json personal context
gobi --json personal context --since 24h --limit 5

# your personal space
gobi --json personal notes list --limit 30
gobi --json personal notes get o0123456789
gobi --json personal activities list --limit 30
gobi --json personal activities get v0123456789

# a space (--mine keeps only notes you recorded)
gobi --json space notes list --space-slug acme --limit 30 --mine
gobi --json space notes get o0123456789
gobi --json space activities list --space-slug acme --limit 30
```

Every list is newest-first and paginated with `--limit` / `--before` (pass a previous response's `nextCursor` to `--before`). Each list row starts with the note's title, then what it was made from.

## Available Commands

Under `gobi personal …` and `gobi space …`:

- `personal context` — one-call personal snapshot: current/latest activity, recent activities, recent notes (summary + speakers), fresh capture notifications (`--since`, `--limit`).
- `notes list` — the lane's notes, newest first (`--limit`, `--before`, `--mine`; `--space-slug` under `space`).
- `notes get <noteId>` — one note: source, summary, side notes, shared artifact, transcript.
- `activities list` — the lane's activities, newest first (`--limit`, `--before`; `--space-slug` under `space`).
- `activities get <activityId>` — one activity (personal only; a space's rows are already complete in `list`).

All commands are read-only.

## Reference Documentation

- [gobi personal](references/personal.md)
- [gobi space](references/space.md)

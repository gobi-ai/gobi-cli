---
name: gobi-sense
description: >-
  Gobi Sense commands for browsing activities and conversations captured by the
  wearable and mobile app. Activities (what you were doing) and conversations
  (phone-mic Audio Logs + detected conversations, with transcripts) all belong to
  your personal core, reached ONLY via `gobi personal activities …` and
  `gobi personal conversations …` — there is no `gobi space` equivalent.
  Read-only. Use when the user wants to review their Sense activities or
  conversations.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.5.1"
---

# gobi-sense

Gobi Sense commands for browsing activities and conversations (v2.5.1).

Requires gobi-cli installed and authenticated. See the **gobi-core** skill for setup.

Sense data is captured by Gobi Sense (the wearable) and the mobile app, then ingested by the cloud pipeline. The CLI surface is **read-only** — list records and fetch transcripts, then feed them to whatever analysis you want to run.

## Scope: your personal core only

Everything Gobi captures lands in your **personal core** (Home), whatever space
happened to be active at the time. So there is exactly one place to browse it:

- `gobi personal activities …` — what you were doing.
- `gobi personal conversations …` — Audio Logs + detected conversations.

There is no `gobi space activities` / `gobi space conversations`. Captures are
yours; a space is its channels and posts. To bring a conversation into a space,
share its note artifact onto a post (see the **gobi-artifact** skill).

## Activities vs conversations

- **activities** — a running log of what you were doing (category + details), each with a start/end time. Yours alone; transcripts are owner-only.
- **conversations** — phone-mic Audio Log recordings plus Sense-detected conversations, each with a transcript and an auto-generated summary. You see your own; the transcript and `audio` signed URL stay owner-only.

The old `gobi sense list-activities` / `gobi sense list-transcriptions` commands are gone — transcriptions were unified into **conversations**, and both concepts now live in the personal core.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **top-level** option (before the subcommand):

```bash
gobi --json personal activities list --limit 30
gobi --json personal conversations list
gobi --json personal activities transcript 978
```

JSON mode wraps the response as `{"success": true, "data": <…>}` (or `{"success": false, "error": "…"}`).

## Typical workflow

List recent activities (newest first, paged with `--limit` / `--before`), then pull one's transcript:

```bash
gobi --json personal activities list --limit 30
gobi --json personal activities get 978
gobi --json personal activities transcript 978
```

List recent conversations, then read a transcript (with its summary) or grab the recording:

```bash
gobi --json personal conversations list
gobi --json personal conversations transcript 12345
gobi --json personal conversations audio 12345
```

`gobi personal activities list` is newest-first and fully paginated with `--limit` / `--before` (pass a previous response's `nextCursor` to `--before`). **`gobi personal conversations list`** is filtered from the cross-scope conversations feed, so it shows your recent conversations rather than a fully paginated history, and takes no paging parameters.

## Available Commands

Under `gobi personal …`:

- `activities list` — List Sense activities in this scope (`--limit`, `--before`, `--mine`).
- `activities get <activityId>` — Get one activity's details.
- `activities transcript <activityId>` — Get an activity's transcript (owner-only).
- `conversations list` — List your conversations, newest first. (`--limit`, `--before` and `--mine` are accepted but inert here — the personal conversations feed takes no parameters.)
- `conversations transcript <conversationId>` — Get a conversation's transcript and summary.
- `conversations audio <conversationId>` — Get a signed URL for the recording (owner-only).

All commands are read-only. `--mine` on either `list` is a no-op — the personal lane is already all yours.

## Reference Documentation

- [gobi personal](references/personal.md)

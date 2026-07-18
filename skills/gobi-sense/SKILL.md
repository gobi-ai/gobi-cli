---
name: gobi-sense
description: >-
  Gobi Sense commands for browsing activities and conversations captured by the
  wearable and mobile app. Activities (what you were doing) and conversations
  (phone-mic Audio Logs + detected conversations, with transcripts) are scoped
  to a space: `gobi personal activities/conversations …` (your personal space)
  or `gobi space activities/conversations …` (the active team space). Read-only.
  Use when the user wants to review their Sense activities or conversations.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.44"
---

# gobi-sense

Gobi Sense commands for browsing activities and conversations (v2.0.44).

Requires gobi-cli installed and authenticated. See the **gobi-core** skill for setup.

Sense data is captured by Gobi Sense (the wearable) and the mobile app, then ingested by the cloud pipeline. The CLI surface is **read-only** — list records and fetch transcripts, then feed them to whatever analysis you want to run.

## Scope: personal vs space

Sense data is tagged with the space it was captured in — either your **personal space** or a **team space**. The commands are the same under each scope; pick the group that matches where the data lives:

- `gobi personal activities …` / `gobi personal conversations …` — your personal space (visible only to you).
- `gobi space activities …` / `gobi space conversations …` — the active team space. The space comes from `.gobi/settings.yaml` (set with `gobi space warp <slug>`) or `gobi space --space-slug <slug> activities …`.

The examples below use `personal`; swap in `space` to browse a team space.

## Activities vs conversations

- **activities** — a running log of what you were doing (category + details), each with a start/end time. In a team space, every member's activities show up, attributed to their recorder. Transcripts are owner-only.
- **conversations** — phone-mic Audio Log recordings plus Sense-detected conversations, each with a transcript and an auto-generated summary. In a team space, every member's conversations show up, attributed to their recorder (the transcript and `audio` signed URL stay owner-only). In your personal space, you see your own.

The old `gobi sense list-activities` / `gobi sense list-transcriptions` commands are gone — transcriptions were unified into **conversations**, and both concepts are now space-scoped.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **top-level** option (before the subcommand):

```bash
gobi --json personal activities list --limit 30
gobi --json personal conversations list
gobi --json space --space-slug my-team activities transcript 978
```

JSON mode wraps the response as `{"success": true, "data": <…>}` (or `{"success": false, "error": "…"}`).

## Typical workflow

List recent activities (newest first, paged with `--limit` / `--before`), then pull one's transcript:

```bash
gobi --json personal activities list --limit 30
gobi --json personal activities get 978
gobi --json personal activities transcript 978
```

List recent conversations in a space, then read a transcript (with its summary) or grab the recording:

```bash
gobi --json space --space-slug my-team conversations list
gobi --json space --space-slug my-team conversations transcript 12345
gobi --json space --space-slug my-team conversations audio 12345
```

Both list commands are newest-first and page with `--limit` / `--before` (pass a previous response's `nextCursor` to `--before`). Scope difference: **`gobi space … activities/conversations list`** is a complete, fully-paginated per-space history (every member's records). **`gobi personal … conversations list`** is filtered from the cross-scope conversations feed, so it shows your recent personal conversations rather than a fully paginated history (`gobi personal activities list` is fully paginated).

## Available Commands

Under `gobi personal …` (personal space) or `gobi space …` (active team space):

- `activities list` — List Sense activities in this scope (`--limit`, `--before`, `--mine`).
- `activities get <activityId>` — Get one activity's details.
- `activities transcript <activityId>` — Get an activity's transcript (owner-only).
- `conversations list` — List conversations captured in this scope, newest first (`--limit`, `--before`, `--mine`). In a space, every member's (attributed to each recorder).
- `conversations transcript <conversationId>` — Get a conversation's transcript and summary.
- `conversations audio <conversationId>` — Get a signed URL for the recording (owner-only).

All commands are read-only. In a space, `--mine` on either `list` restricts it to records **you** recorded (`user_id = you`); it's a no-op in the personal lane, which is already all yours.

## Reference Documentation

- [gobi personal](references/personal.md)
- [gobi space](references/space.md)

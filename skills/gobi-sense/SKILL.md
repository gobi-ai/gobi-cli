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
  version: "2.0.46"
---

# gobi-sense

Gobi Sense commands for browsing activities and conversations (v2.0.46).

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

---
name: gobi-sense
description: >-
  Gobi Sense commands for browsing activities and conversations captured by the
  wearable, mobile app, and desktop. Activities (what you were doing) always
  belong to your personal core (`gobi personal activities …`). Conversations
  (ambient Sense + intentional phone/desktop Audio Logs) live in your personal
  core (`gobi personal conversations …`) AND, when recorded while a space was
  active, in that space (`gobi space conversations …`). Read-only. Use when the
  user wants to review their Sense activities or conversations.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.5.7"
---

# gobi-sense

Gobi Sense commands for browsing activities and conversations (v2.5.7).

Requires gobi-cli installed and authenticated. See the **gobi-core** skill for setup.

Sense data is captured by Gobi Sense (the wearable), the mobile app, and the desktop app, then ingested by the cloud pipeline. The CLI surface is **read-only** — list records and read a conversation's content, then feed it to whatever analysis you want to run.

## Two scopes

- **`gobi personal …`** — your personal core (Home). Holds **activities** AND **conversations**. Every activity lands here whatever space was active; conversations captured with no active space land here too.
- **`gobi space …`** — **conversations only.** A conversation captured while a space was active is filed with that space's id and listed for every member, attributed to each recorder. There is deliberately **no `gobi space activities`**: an activity is always filed in the personal core (the backend exposes no space-activities route).

To bring a conversation into a space's feed, share its note artifact onto a post (see the **gobi-artifact** skill).

## Activities vs conversations

- **activities** — a running log of what you were doing (category + details), each with a start/end time. Yours alone; transcripts are owner-only. Personal scope only.
- **conversations** — recordings with a diarized transcript and an auto-generated summary. The `source` field distinguishes **ambient** capture (`sense`, the always-on wearable) from **intentional** capture (`mobile` / `desktop`, an explicit Audio Log) — a meaningful difference in character, surfaced on every line.

The old `gobi sense list-activities` / `gobi sense list-transcriptions` commands are gone — transcriptions were unified into **conversations**, reached under `gobi personal` / `gobi space`.

## A conversation's four components

`conversations get <id>` returns one conversation's content in four parts:

- **summary** — the AI-generated note body, inline on the conversation.
- **side notes** — what the user typed in the recorder (absent when none).
- **note artifact** — the shareable note, minted only once the conversation is shared; otherwise the summary stays inline and there is no artifact.
- **transcript** — the diarized turns, speakers resolved to names.

Raw **audio is never exposed** — it is private by default. Transcript, summary and side notes are **owner-only**: reading someone else's conversation returns an empty shell.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **top-level** option (before the subcommand):

```bash
gobi --json personal conversations list
gobi --json personal conversations get 12345
gobi --json space conversations list --space-slug acme
```

JSON mode wraps the response as `{"success": true, "data": <…>}` (or `{"success": false, "error": "…"}`), and preserves raw fields (e.g. the summary's markdown frontmatter) that the human view trims.

## Typical workflow

Activities (personal only) — newest-first, fully paginated with `--limit` / `--before`:

```bash
gobi --json personal activities list --limit 30
gobi --json personal activities get 978
gobi --json personal activities transcript 978
```

Conversations — list, then read one's four components with `get`:

```bash
# personal core (cross-scope feed filtered to yours; no paging params)
gobi --json personal conversations list
gobi --json personal conversations get 12345

# a space's conversations (real pagination; --mine filters to your own)
gobi --json space conversations list --space-slug acme --limit 30 --mine
gobi --json space conversations get 12345
```

`gobi space conversations list` is newest-first and fully paginated with `--limit` / `--before` (pass a previous response's `nextCursor` to `--before`); `--mine` keeps only conversations you recorded. `gobi personal conversations list` is filtered from the cross-scope feed, so it shows your recent conversations rather than a paginated history and takes no paging parameters (`--limit` / `--before` / `--mine` are inert there — the personal lane is already all yours).

## Available Commands

Under `gobi personal …`:

- `activities list` — List activities in your personal core (`--limit`, `--before`, `--mine`).
- `activities get <activityId>` — Get one activity's details.
- `activities transcript <activityId>` — Get an activity's transcript (owner-only).
- `conversations list` — List your conversations, newest first (`--limit` / `--before` / `--mine` accepted but inert here).
- `conversations get <conversationId>` — Get a conversation's summary, side notes, linked note artifact, and transcript (owner-only).

Under `gobi space …`:

- `conversations list` — List the space's conversations, newest first, attributed to each recorder (`--space-slug`, `--limit`, `--before`; `--mine` keeps only yours).
- `conversations get <conversationId>` — Same four-component view as personal (owner-only for content).

All commands are read-only. Audio is never exposed.

## Reference Documentation

- [gobi personal](references/personal.md)

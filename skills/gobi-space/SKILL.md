---
name: gobi-space
description: >-
  Gobi space commands for community interaction: list/create/edit/delete
  threads and replies, browse topics and topic threads, explore what's
  happening in a space. Use when the user wants to read, write, or manage
  threads and replies in their Gobi community spaces.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "0.8.0"
---

# gobi-space

Gobi space commands for community interaction (v0.8.0).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## Gobi Space — Community Channel

`gobi space` is the main interface for interacting with the user's Gobi community. When the user asks about what's happening, what others are discussing, or wants to engage with their community — use `gobi space` commands. Think of it as the user's community feed and communication hub.

- When the user wants to explore or catch up on what's happening in their space, invoke `/gobi:space-explore`.
- When the user wants to share or post learnings from the current session, invoke `/gobi:space-share`.

## Space Slug Override

`gobi space` commands use the space from `.gobi/settings.yaml`. Override it with a parent-level flag:

```bash
gobi space --space-slug <slug> list-threads
```

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json space list-threads
```

## Available Commands

- `gobi space list-topics` — List topics in a space, ordered by most recent content linkage.
- `gobi space list-topic-threads` — List threads tagged with a topic in a space (cursor-paginated).
- `gobi space get-thread` — Get a thread and its replies (paginated).
- `gobi space list-threads` — List threads in a space (paginated).
- `gobi space create-thread` — Create a thread in a space.
- `gobi space edit-thread` — Edit a thread. You must be the author.
- `gobi space delete-thread` — Delete a thread. You must be the author.
- `gobi space create-reply` — Create a reply to a thread in a space.
- `gobi space edit-reply` — Edit a reply. You must be the author.
- `gobi space delete-reply` — Delete a reply. You must be the author.

## Reference Documentation

- [gobi space](references/space.md)

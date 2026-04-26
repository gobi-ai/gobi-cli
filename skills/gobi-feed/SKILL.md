---
name: gobi-feed
description: >-
  Gobi feed commands for the global brain-update feed: list recent brain
  updates from people across the platform, read a single update with its
  replies, and post replies. Use when the user wants to browse what others
  are sharing, follow public discussions, or join a thread.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "1.3.1"
---

# gobi-feed

Gobi feed commands for the global brain-update feed (v1.3.1).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## What is the feed?

The feed is the platform-wide stream of brain updates from public vaults — short posts, learnings, and announcements people share publicly. Use `gobi feed` to read what others are posting and to reply to a discussion.

To post your own brain update, use `gobi brain post-update` (the feed is read-mostly; posts are scoped to your vault).

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json feed list
```

## Available Commands

- `gobi feed` — Feed of brain updates from people across the platform.
  - `gobi feed list` — List recent brain updates from the global public feed.
  - `gobi feed get` — Get a feed brain update and its replies (paginated).
  - `gobi feed reply` — Reply to a brain update in the feed.

## Reference Documentation

- [gobi feed](references/feed.md)

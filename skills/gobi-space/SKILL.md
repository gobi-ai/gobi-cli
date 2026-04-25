---
name: gobi-space
description: >-
  Gobi space commands for community interaction: create/list spaces,
  manage members, post threads and replies, browse the unified message
  feed and topic feeds, walk reply lineage, and post to the global
  (slugless) space. Use when the user wants to read, write, or manage
  threads, replies, or membership in their Gobi community spaces.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "0.9.13"
---

# gobi-space

Gobi space commands for community interaction (v0.9.13).

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

### Space management
- `gobi space create` — Create a new space.
- `gobi space get` — Get details for a space.

### Topics
- `gobi space list-topics` — List topics in a space, ordered by most recent content linkage.
- `gobi space list-topic-threads` — List threads tagged with a topic in a space (cursor-paginated).

### Feed & lineage
- `gobi space messages` — List the unified message feed (threads and replies, newest first).
- `gobi space ancestors` — Show the ancestor lineage of a thread or reply (root → immediate parent).

### Threads
- `gobi space get-thread` — Get a thread and its replies (paginated).
- `gobi space list-threads` — List threads in a space (paginated).
- `gobi space create-thread` — Create a thread in a space.
- `gobi space edit-thread` — Edit a thread. You must be the author.
- `gobi space delete-thread` — Delete a thread. You must be the author.

### Replies
- `gobi space create-reply` — Create a reply to a thread in a space.
- `gobi space edit-reply` — Edit a reply. You must be the author.
- `gobi space delete-reply` — Delete a reply. You must be the author.

### Members
- `gobi space list-members` — List members of a space (cursor-paginated).
- `gobi space invite-member` — Invite a user to the space by email (owner only).
- `gobi space join-space` — Join a space via invite link.
- `gobi space request-access` — Request access to a space.
- `gobi space accept-invite` — Accept an invitation to a space.
- `gobi space approve-member` — Approve a pending membership request (owner only).
- `gobi space leave-space` — Leave a space.

### Global thread space
The global thread space has no slug and is visible across all spaces.

- `gobi global messages` — List the global unified message feed (newest first).
- `gobi global get-thread` — Get a global thread and its direct replies.
- `gobi global ancestors` — Show the ancestor lineage of a global thread or reply.
- `gobi global create-thread` — Create a thread in the global space.
- `gobi global reply` — Reply to a thread in the global space.

## Reference Documentation

- [gobi space](references/space.md)
- [gobi global](references/global.md)

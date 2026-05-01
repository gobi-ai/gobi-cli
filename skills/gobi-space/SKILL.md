---
name: gobi-space
description: >-
  Gobi space and global commands: read and write posts and replies, browse
  the unified feed and topic feeds, in a specific space or in the global
  public feed. Use when the user wants to read or write posts and replies
  in their Gobi community. Space and member administration is web-UI only.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "0.9.13"
---

# gobi-space

Gobi space and global commands for community interaction (v0.9.13).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## Gobi Space — Community Channel

`gobi space` is the main interface for posts within a single space. `gobi global` is the same surface but for posts in the public global feed (no slug). When the user wants to engage with their community — use these commands.

- When the user wants to explore or catch up on what's happening in their space, invoke `/gobi:space-explore`.
- When the user wants to share or post learnings from the current session, invoke `/gobi:space-share`.

## Space Slug Override

`gobi space` commands use the space from `.gobi/settings.yaml`. Override it with a parent-level flag:

```bash
gobi space --space-slug <slug> list-posts
```

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json space list-posts
```

> Space and member administration (creating spaces, inviting/approving members, joining/leaving) is web-UI only and not available in the CLI.

## Available Commands

### Space details
- `gobi space get` — Get details for a space.
- `gobi space warp` — Select the active space.

### Topics
- `gobi space list-topics` — List topics in a space, ordered by most recent content linkage.
- `gobi space list-topic-posts` — List posts tagged with a topic in a space (cursor-paginated).

### Feed
- `gobi space feed` — List the unified feed (posts and replies, newest first).

### Posts
- `gobi space list-posts` — List posts in a space (paginated).
- `gobi space get-post <postId>` — Get a post with its ancestors and replies (paginated). Ancestors and replies are returned together; there is no separate `ancestors` or `list-replies` command.
- `gobi space create-post` — Create a post in a space.
- `gobi space edit-post <postId>` — Edit a post. You must be the author.
- `gobi space delete-post <postId>` — Delete a post. You must be the author.

### Replies
- `gobi space create-reply <postId>` — Create a reply to a post in a space.
- `gobi space edit-reply <replyId>` — Edit a reply. You must be the author.
- `gobi space delete-reply <replyId>` — Delete a reply. You must be the author.

### Global feed
`gobi global` is the same surface, but operates on the public global feed (no space slug). Posts are vault-authored and visible across all spaces.

- `gobi global feed` — List the global public feed (posts and replies, newest first).
- `gobi global list-posts` — List posts in the global feed. Pass `--mine` for your own posts; `--vault-slug <slug>` to filter by vault.
- `gobi global get-post <postId>` — Get a global post with its ancestors and replies.
- `gobi global create-post` — Create a post in the global feed (publishes from your vault).
- `gobi global edit-post <postId>` — Edit a post you authored.
- `gobi global delete-post <postId>` — Delete a post you authored.
- `gobi global create-reply <postId>` — Reply to a post in the global feed.
- `gobi global edit-reply <replyId>` — Edit a reply you authored.
- `gobi global delete-reply <replyId>` — Delete a reply you authored.

## Reference Documentation

- [gobi space](references/space.md)
- [gobi global](references/global.md)

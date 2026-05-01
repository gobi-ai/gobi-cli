---
name: gobi-space
description: >-
  Gobi space and global commands: read and write posts and replies, browse the
  unified feed and topic feeds — in a community space (`gobi space`) or in the
  public global feed of personal posts (`gobi global`). Personal Posts and
  Space Posts share the same data model; only the scope differs. Use when the
  user wants to read or write posts and replies. Space and member admin is
  web-UI only.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.0"
---

# gobi-space

Gobi space and global posts (v2.0.0).

Requires gobi-cli installed and authenticated. See the **gobi-core** skill for setup.

## Two scopes, one data model

The same `Post` data type drives both surfaces — the difference is **scope**:

- **Space Post** — `gobi space …` — lives in a community space's feed.
- **Personal Post** — `gobi global …` — lives on the author's profile (their primary vault) and surfaces in the public global feed.

Anything you can do to a Space Post (reply, edit, delete, attribute to a vault) you can do to a Personal Post.

- When the user wants to explore or catch up on what's happening in their space, invoke `/gobi:space-explore`.
- When the user wants to share or post learnings from the current session, invoke `/gobi:space-share`.

## Author vault attribution (`--vault-slug`)

Both `gobi space create-post` / `edit-post` and `gobi global create-post` / `edit-post` accept `--vault-slug <slug>`. When set, the slug becomes the post's `authorVaultSlug` — the vault the user is posting on behalf of. The caller must hold `role: 'owner'` on that vault. Pass `--vault-slug ""` on edit to detach.

`--auto-attachments` resolves a vault for upload and **also** uses it as `authorVaultSlug` automatically — one flag, two effects.

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

### Space posts
- `gobi space list-posts` — List posts in a space (paginated).
- `gobi space get-post <postId>` — Get a post with its ancestors and replies (paginated). Ancestors and replies are returned together; there is no separate `ancestors` or `list-replies` command.
- `gobi space create-post` — Create a space post. `--vault-slug` attributes it to a vault you own; `--auto-attachments` uploads `[[wikilinks]]` to that vault and uses it as `authorVaultSlug`.
- `gobi space edit-post <postId>` — Edit a space post. You must be the author. `--vault-slug ""` detaches the vault.
- `gobi space delete-post <postId>` — Delete a space post. You must be the author.

### Space replies
- `gobi space create-reply <postId>` — Create a reply to a space post.
- `gobi space edit-reply <replyId>` — Edit a reply. You must be the author.
- `gobi space delete-reply <replyId>` — Delete a reply. You must be the author.

### Personal posts (global feed)

`gobi global` is the same surface for Personal Posts — posts that live on the author's profile and surface in the public global feed.

- `gobi global feed` — List the public global feed (posts and replies, newest first).
- `gobi global list-posts` — List personal posts. `--mine` for your own; `--vault-slug <slug>` to filter by author vault.
- `gobi global get-post <postId>` — Get a personal post with its ancestors and replies.
- `gobi global create-post` — Create a personal post. `--vault-slug` and `--auto-attachments` work the same as on `space create-post`.
- `gobi global edit-post <postId>` — Edit a personal post you authored. `--vault-slug ""` detaches the vault.
- `gobi global delete-post <postId>` — Delete a personal post you authored.
- `gobi global create-reply <postId>` — Reply to a personal post.
- `gobi global edit-reply <replyId>` — Edit a reply you authored.
- `gobi global delete-reply <replyId>` — Delete a reply you authored.

## Reference Documentation

- [gobi space](references/space.md)
- [gobi global](references/global.md)

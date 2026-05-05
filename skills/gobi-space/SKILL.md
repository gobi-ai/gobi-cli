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
  version: "2.0.4"
---

# gobi-space

Gobi space and global posts (v2.0.4).

Requires gobi-cli installed and authenticated. See the **gobi-core** skill for setup.

## Two scopes, one data model

The same `Post` data type drives both surfaces — the difference is **scope**:

- **Space Post** — `gobi space …` — lives in a community space's feed.
- **Personal Post** — `gobi global …` — lives on the author's profile (their primary vault) and surfaces in the public global feed.

Anything you can do to a Space Post (reply, edit, delete, attribute to a vault) you can do to a Personal Post.

- When the user wants to explore or catch up on what's happening in their space, invoke `/gobi:space-explore`.
- When the user wants to share or post learnings from the current session, invoke `/gobi:space-share`.

## Authoring posts: title vs. content

`create-post` (and `edit-post`) on both `gobi space` and `gobi global` take `--title` and `--content` as **separate** fields. The title is rendered as the post heading by the UI, so it must not also appear inside `--content`:

- Do **not** repeat the title as a heading (`# My title`) or as the first line of `--content`. The reader will see it twice.
- Start `--content` with the body itself.
- If you only have a single blob of markdown, split it: take the first heading or sentence as `--title`, drop that line, and pass the rest as `--content`.
- On `edit-post`, the same rule applies — if you change `--title`, scrub any duplicate of the old or new title from `--content` too.

The same applies to replies: a reply has only `--content` (no title), so do not synthesize a title-like heading at the top of a reply either.

## Author vault attribution (`--vault-slug`)

Both `gobi space create-post` / `edit-post` and `gobi global create-post` / `edit-post` accept `--vault-slug <slug>`. When set, the slug becomes the post's `authorVaultSlug` — the vault the user is posting on behalf of. The caller must hold `role: 'owner'` on that vault. Pass `--vault-slug ""` on edit to detach.

`--auto-attachments` resolves a vault for upload and **also** uses it as `authorVaultSlug` automatically — one flag, two effects.

## Prerequisites & space slug

`gobi space` commands do **not** require a vault to be configured in `.gobi/settings.yaml`. They only need a space slug, which can come from either:

1. `selectedSpaceSlug` in `.gobi/settings.yaml` (set via `gobi space warp`), or
2. A parent-level `--space-slug <slug>` flag passed at call time, which overrides `.gobi`:

   ```bash
   gobi space --space-slug <slug> list-posts
   ```

If `.gobi/settings.yaml` has no `selectedSpaceSlug` and `--space-slug` isn't passed, the command will error.

`gobi global` commands target the public global feed and have no space requirement and no `.gobi` requirement. `gobi global create-post` is symmetric with `gobi space create-post`: a vault is **optional** — pass `--vault-slug <slug>` (or rely on `.gobi`'s `vaultSlug` when using `--auto-attachments`) to attribute the post; with neither flag the post is created without an `authorVaultSlug`.

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
- `gobi global create-post` — Create a personal post. `--vault-slug` and `--auto-attachments` work the same as on `space create-post`. Both are optional: with neither, the post is created without an `authorVaultSlug` (vault-less personal post).
- `gobi global edit-post <postId>` — Edit a personal post you authored. `--vault-slug ""` detaches the vault; `--auto-attachments` uploads wiki-links before saving.
- `gobi global delete-post <postId>` — Delete a personal post you authored.
- `gobi global create-reply <postId>` — Reply to a personal post.
- `gobi global edit-reply <replyId>` — Edit a reply you authored. Accepts `--auto-attachments` and `--vault-slug` for attachment uploads (mirrors `space edit-reply`).
- `gobi global delete-reply <replyId>` — Delete a reply you authored.

## Confirm before mutating

Posts and replies are publicly visible — in a community space (`gobi space …`) or in the global feed (`gobi global …`). Before running any write, confirm with the user — show the exact command and the resolved title, content (or a short preview), and `authorVaultSlug` if `--vault-slug` / `--auto-attachments` is set. This applies even when running autonomously.

- `create-post` / `create-reply` — content goes live on submission.
- `edit-post` / `edit-reply` — confirm the *new* content; people who already saw the original may re-see it.
- `delete-post` / `delete-reply` — irreversible. Flag that explicitly and confirm the target id before running.

Read-only commands (`list-posts`, `get-post`, `feed`, `list-topics`, `list-topic-posts`, `get`) run without confirmation.

## Reference Documentation

- [gobi space](references/space.md)
- [gobi global](references/global.md)

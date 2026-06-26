---
name: gobi-space
description: >-
  Gobi space, global, and personal-space commands: read and write posts and
  replies, browse the unified feed and topic feeds — in a community space
  (`gobi space`), in the public global feed of personal posts (`gobi global`),
  or in your private personal-space feed visible only to you (`gobi personal`).
  All three share the same `Post` data model; only the scope differs. Use when
  the user wants to read or write posts and replies. Space and member admin is
  web-UI only.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.35"
---

# gobi-space

Gobi space, global, and personal-space posts (v2.0.35).

Requires gobi-cli installed and authenticated. See the **gobi-core** skill for setup.

## Three scopes, one data model

The same `Post` data type drives all three surfaces — the difference is **scope**:

- **Space Post** — `gobi space …` — lives in a community space's feed.
- **Personal Post** — `gobi global …` — lives on the public global feed.
- **Personal-space Post** — `gobi personal …` — private posts and replies visible only to the author. Same shape as `gobi global`, scoped via `personalSpaceUserId` so they never surface on the public feed.

Anything you can do to a Space Post (reply, edit, delete) you can do to a Personal Post or a Personal-space Post.

- When the user wants to explore or catch up on what's happening in their space, invoke `/gobi:space-explore`.
- When the user wants to share or post learnings from the current session, invoke `/gobi:space-share`.
- When the user wants to draft a post from the current session and route it to whichever space(s) it best fits, invoke `/gobi:post` (default approval mode; pass `bypass` to skip confirmation).

## Authoring posts: title vs. content

`create-post` (and `edit-post`) on `gobi space`, `gobi global`, and `gobi personal` all take `--title` and `--content` as **separate** fields. The title is rendered as the post heading by the UI, so it must not also appear inside `--content`:

- Do **not** repeat the title as a heading (`# My title`) or as the first line of `--content`. The reader will see it twice.
- Start `--content` with the body itself.
- If you only have a single blob of markdown, split it: take the first heading or sentence as `--title`, drop that line, and pass the rest as `--content`.
- On `edit-post`, the same rule applies — if you change `--title`, scrub any duplicate of the old or new title from `--content` too.

The same applies to replies: a reply has only `--content` (no title), so do not synthesize a title-like heading at the top of a reply either.

## Attaching artifacts (`--artifact`)

Posts have no vault attribution. Both `create-post` and `edit-post` across all three scopes (`gobi space`, `gobi global`, `gobi personal`) accept `--artifact <artifactId>` (repeatable) to attach existing artifacts. On `create-post` it sets the new post's artifacts; on `edit-post` it **replaces** the post's artifact set wholesale (pass every artifact you want; omit `--artifact` to leave them unchanged). The same artifact can be attached to multiple posts — it's a reusable, versioned creation, and each post renders its currently-published revision. To author a vault-anchored document, create a markdown artifact (`gobi artifact create --kind markdown --vault-slug <slug>`) and attach it via `--artifact`. See the **gobi-artifact** skill.

> **Wiki-link uploads moved to artifacts.** The `--auto-attachments` flag that used to upload `[[wiki-linked files]]` from a post body now lives on `gobi artifact create` / `gobi artifact revise` (markdown kinds). To publish a markdown creation with resolvable wikilinks, create a markdown artifact with `--vault-slug` + `--auto-attachments` and attach it to the post (`--post-id`). See the **gobi-artifact** skill. Before relying on wikilink resolution, confirm the anchor vault is published: `gobi --json vault status --vault-slug <slug>` should report `isPublished: true`.

## Post media + file attachments (`--attach`)

`create-post` and `create-reply` across all three scopes (`gobi space`, `gobi global`, `gobi personal`) accept `--attach <file>` (repeatable) for inline post attachments — photos/GIF/video that render in-feed alongside the post body, and document files (**pdf/md/txt/csv**) that render as Slack-style file cards. The CLI uploads each file to S3 via `POST /posts/upload-url`; document files additionally carry `fileName` + `mimeType` on the row (the S3 key is a UUID, so that's the only place the original name survives).

Mix rule (enforced client-side before upload): up to **4 photos + 4 document files** together, OR **1 GIF**, OR **1 video** — GIF and video are exclusive with everything. Size ceilings: 10MB photos, 15MB GIFs, 512MB video, 250MB document files.

Use `--attach` for media/files you want shown in the post itself; use a markdown **artifact** (`gobi artifact create`) for `[[wikilinks]]`-bearing creations attached to the post.

**Reading attachments back:** feed and list lines show a compact marker like `📎 2 photos, 1 file`; `get-post` prints an `Attachments (N):` block with one line per attachment — kind, original fileName, dimensions/MIME, and the fetchable CDN URL (artifact attachments show kind/title/artifactId instead). In `--json` mode the full `attachments` array is on every post/reply object.

## Public link formats

Once a post is created, you can build a shareable URL from the response:

- **Personal post** — `https://gobispace.com/posts/{id}` (e.g. `https://gobispace.com/posts/144869`). This is the canonical share link for `gobi global` posts.
- **Space post** — `https://gobispace.com/spaces/{spaceSlug}?postId={id}` (overlay on the space feed) or `https://gobispace.com/spaces/{spaceSlug}/posts/{id}` (dedicated page).
- **Vault profile** — `https://gobispace.com/@{vaultSlug}`.
- **Vault file** — `https://gobispace.com/file/{vaultSlug}?path={path}` (e.g. `https://gobispace.com/file/jyk?path=notes/intro.md`). First-class URL for linking to a single file from a published vault — renders in the main feed chrome (not the vault homepage). Use this when a post body or reply needs to point readers at a specific vault file. URL-encode each path segment. See **gobi-vault** skill for full semantics.

When you echo a "Post created!" line (or the JSON response is consumed by another agent), include the assembled URL using the fields actually returned — `id` for global posts, `spaceSlug` + `id` for space posts. Don't fabricate slugs.

## Prerequisites & space slug

`gobi space` commands do **not** require a vault to be configured in `.gobi/settings.yaml`. They only need a space slug, which can come from either:

1. `selectedSpaceSlug` in `.gobi/settings.yaml` (set via `gobi space warp`), or
2. A parent-level `--space-slug <slug>` flag passed at call time, which overrides `.gobi`:

   ```bash
   gobi space --space-slug <slug> list-posts
   ```

If `.gobi/settings.yaml` has no `selectedSpaceSlug` and `--space-slug` isn't passed, the command will error.

`gobi global` commands target the public global feed and have no space requirement and no `.gobi` requirement. `gobi global create-post` is symmetric with `gobi space create-post`: attach existing artifacts with `--artifact <artifactId>` (repeatable).

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
- `gobi space feed` — List the unified feed (posts and replies, newest first). `--channel <channelId>` reads a channel's feed instead of the main feed.

### Search
- `gobi space search-posts <query>` — Search a space's posts **and** replies, newest first. The query supports free-text keywords plus `from:<name>` (author) and `topic:<tag>` operators; quote multi-word values (`from:"Jane Doe"`). Each result is an individual post or reply, not a whole thread. `--channel <channelId>` restricts results to one channel; omit to search the main feed and every channel visible to you.
- `gobi personal search-posts <query>` — Same query syntax over your private personal-space posts and replies. There is no `gobi global` search.

### Space posts
- `gobi space list-posts` — List posts in a space (paginated).
- `gobi space get-post <postId>` — Get a post with its ancestors and replies (paginated). Ancestors and replies are returned together; there is no separate `ancestors` or `list-replies` command.
- `gobi space create-post` — Create a space post. `--artifact <artifactId>` (repeatable) attaches existing artifacts.
- `gobi space edit-post <postId>` — Edit a space post. You must be the author.
- `gobi space delete-post <postId>` — Delete a space post. You must be the author.

### Space replies
- `gobi space create-reply <postId>` — Create a reply to a space post.
- `gobi space edit-reply <replyId>` — Edit a reply. You must be the author.
- `gobi space delete-reply <replyId>` — Delete a reply. You must be the author.

### Reactions

Emoji reactions on posts **and** replies, across all three scopes (`gobi space`, `gobi global`, `gobi personal`). The id is the bare number from the `[p:N]`/`[r:N]` ids in feed output. Feed and `get-post` lines render existing reactions as compact chips like `👍2* 🎉1` — the count follows each emoji, and a trailing `*` marks ones you reacted with.

- `gobi space react <postId> <emoji>` — Add a reaction (idempotent; re-reacting with the same emoji is a no-op).
- `gobi space unreact <postId> <emoji>` — Remove your reaction. Pass the emoji literally (`gobi space unreact 123 👍`).

### Channels (space scope only)

Channels are private, member-gated sub-feeds inside a space. The **main feed is not a channel** — `feed` / `list-posts` / `create-post` without `--channel` target it, as always. Members see their own channels; space owners/admins see all of them; the space agent sees only channels with agent access enabled. Posting into a channel requires being able to see it. Channel administration (create, rename, delete, add/remove members, leave) is web-UI only — like space and member admin, the CLI deliberately doesn't expose it.

- `gobi space list-channels` — List channels visible to you (shows member count, your membership, agent access).
- `gobi space get-channel <channelId>` — Get one channel's details.
- `gobi space list-channel-members <channelId>` — List a channel's members.
- `--channel <channelId>` on `feed`, `list-posts`, and `create-post` reads/writes that channel instead of the main feed.

### Personal posts (global feed)

`gobi global` is the same surface for Personal Posts — posts that live on the author's profile and surface in the public global feed.

- `gobi global feed` — List the public global feed (posts and replies, newest first).
- `gobi global list-posts` — List personal posts. `--mine` for your own.
- `gobi global get-post <postId>` — Get a personal post with its ancestors and replies.
- `gobi global create-post` — Create a personal post. `--artifact <artifactId>` (repeatable) attaches existing artifacts.
- `gobi global edit-post <postId>` — Edit a personal post you authored.
- `gobi global delete-post <postId>` — Delete a personal post you authored.
- `gobi global create-reply <postId>` — Reply to a personal post.
- `gobi global edit-reply <replyId>` — Edit a reply you authored.
- `gobi global delete-reply <replyId>` — Delete a reply you authored.

### Personal-space posts (private)

`gobi personal` mirrors `gobi global`'s subcommand and write-flag shape, but every row is scoped to a private personal space (`personalSpaceUserId`). Nothing here surfaces on the public global feed — these posts are visible only to you. Use for private notes-as-posts, scratch drafts, or any post you want to author against your vault without making it public.

A couple of read-side flags don't mirror — `personal feed` has no `--following` (there's no follow graph in a private space), and `personal list-posts` has no `--mine` (everything in the personal space is already yours).

- `gobi personal feed` — Your personal-space feed (posts and replies, newest first).
- `gobi personal search-posts <query>` — Search your personal-space posts and replies (same `from:` / `topic:` query syntax as `gobi space search-posts`).
- `gobi personal list-posts` — List your personal-space posts.
- `gobi personal get-post <postId>` — Get a personal-space post with its ancestors and replies.
- `gobi personal create-post` — Create a private personal-space post. Same flags as `gobi global create-post` (`--artifact`, `--repost-post-id`, `--attach`).
- `gobi personal edit-post <postId>` — Edit a personal-space post you authored.
- `gobi personal delete-post <postId>` — Delete a personal-space post you authored.
- `gobi personal create-reply <postId>` — Reply to a personal-space post (inherits the parent's private scope).
- `gobi personal edit-reply <replyId>` — Edit a reply you authored.
- `gobi personal delete-reply <replyId>` — Delete a reply you authored.

## Confirm before mutating

Most posts and replies are publicly visible — in a community space (`gobi space …`) or in the global feed (`gobi global …`). `gobi personal …` is the exception: those rows are private to the author. Either way, before running any write, confirm with the user — show the exact command and the resolved title, content (or a short preview), and any attached artifact ids. This applies even when running autonomously.

- `create-post` / `create-reply` — content goes live on submission.
- `edit-post` / `edit-reply` — confirm the *new* content; people who already saw the original may re-see it.
- `delete-post` / `delete-reply` — irreversible. Flag that explicitly and confirm the target id before running.
- `react` / `unreact` are lightweight and reversible — when the user asked for the reaction, no extra confirmation needed.

Read-only commands (`list-posts`, `get-post`, `feed`, `search-posts`, `list-topics`, `list-topic-posts`, `get`, `list-channels`, `get-channel`, `list-channel-members`) run without confirmation.

## Reference Documentation

- [gobi space](references/space.md)
- [gobi global](references/global.md)
- [gobi personal](references/personal.md)

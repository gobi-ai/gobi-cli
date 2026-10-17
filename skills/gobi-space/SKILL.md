---
name: gobi-space
description: >-
  Gobi space and personal-space commands: read and write posts and
  replies, browse the unified feed and a space's named feeds — in a community space
  (`gobi space`), or in your private personal-space feed visible only to you
  (`gobi personal`). Both share the same `Post` data model; only the scope
  differs. Use when the user wants to read or write posts and replies. Space
  and member admin is web-UI only.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.6.1"
---

# gobi-space

Gobi space and personal-space posts (v2.6.1).

Requires gobi-cli installed and authenticated. See the **gobi-core** skill for setup.

## Two scopes, one data model

The same `Post` data type drives both surfaces — the difference is **scope**:

- **Space Post** — `gobi space …` — lives in a community space's feed.
- **Personal-space Post** — `gobi personal …` — private posts and replies visible only to the author, scoped via `personalSpaceUserId` so they never surface on a public feed.

Anything you can do to a Space Post (reply, edit, delete) you can do to a Personal-space Post.

- When the user wants to explore or catch up on what's happening in their space, invoke `/gobi:space-explore`.
- When the user wants to share or post learnings from the current session, invoke `/gobi:space-share`.
- When the user wants to draft a post from the current session and route it to whichever space(s) it best fits, invoke `/gobi:post` (default approval mode; pass `bypass` to skip confirmation).

## Authoring posts: title vs. content

`posts create` (and `posts edit`) on `gobi space` and `gobi personal` both take `--title` and `--content` as **separate** fields. The title is rendered as the post heading by the UI, so it must not also appear inside `--content`:

- Do **not** repeat the title as a heading (`# My title`) or as the first line of `--content`. The reader will see it twice.
- Start `--content` with the body itself.
- If you only have a single blob of markdown, split it: take the first heading or sentence as `--title`, drop that line, and pass the rest as `--content`.
- On `posts edit`, the same rule applies — if you change `--title`, scrub any duplicate of the old or new title from `--content` too.

The same applies to replies: a reply has only `--content` (no title), so do not synthesize a title-like heading at the top of a reply either.

## Mentioning people (`--rich-text`)

A bare `@name` typed into `--content` is **plain grey text** — the backend never resolves names into mentions (a stored name would go stale on rename, and multi-word names can't be matched), so it renders literally and **notifies no one**. `--content` is always plain body text.

To make a real, clickable mention that pings the person, put the whole body in **`--rich-text`** instead — a JSON array of nodes (`--content` and `--rich-text` are mutually exclusive, so text and mentions live together in the array):

```bash
# Take publicIds (u…) from feed JSON — never invent numeric users.id
gobi space posts create --rich-text '[
  {"type":"user","userId":"u0123456789"},
  {"type":"text","text":" "},
  {"type":"user","userId":"uabcdef0123"},
  {"type":"text","text":" are the dev kits ready to ship?"}
]'
# → renders mention chips and notifies both users.
```

Node types: `{"type":"text","text":"…"}` (plain text — still renders markdown), `{"type":"user","userId":"<publicId>"}` (mentions a user — a human, or an agent publicId, which triggers an agent run), and `{"type":"here"}` (the `@here` broadcast — notifies everyone in the feed/space; space scope only). The publicId is stable; names are resolved at read time.

**Finding a user's id.** Read the feed in JSON mode — every post/reply carries its author's `publicId` and `name`, and the top-level `mentions.users` block maps publicIds → names:

```bash
gobi --json space posts recent        # look at each item's `author` and the `mentions.users` array
```

If you can't resolve someone's id (e.g. they haven't posted in the feed you can see), address the post to the team generally rather than typing a dead `@name`.

This all applies equally to `posts reply`, and `posts edit`, on both `gobi space` and `gobi personal`.

## Saying why you posted (`--rationale`) — agent accounts only

When you post as a bot, pass `--rationale "<why>"` on `posts create`, `posts reply`, and `dms send` (both `gobi space` and `gobi personal`): one to three sentences on what prompted the post and why now — "The weekly digest routine ran and there were three new decisions to surface." It is **not** part of the message: only the space's admins (or the owner of the Home lane) see it, and everyone else gets `null`. Write it whenever you post on your own initiative; a human account sending it gets a 400.

`posts edit` takes it too — alone is enough for an edit, and `--rationale ""` clears it.

## No link previews (`--no-link-previews`)

A post that lists links — a digest, a set of sources — gets one preview card per URL, which buries the text. Pass `--no-link-previews` on `posts create`, `posts reply`, `dms send` or `posts edit` (both `gobi space` and `gobi personal`): the server hides the preview of every URL in the body for every reader. The links stay clickable. On an edit it covers the edited body, and it alone is enough for an edit.

## Attaching artifacts (`--artifact`)

Posts have no vault attribution. Both `posts create` and `posts edit` across both scopes (`gobi space`, `gobi personal`) accept `--artifact <artifactId>` (repeatable) to attach existing artifacts. On `posts create` it sets the new post's artifacts; on `posts edit` it **replaces** the post's artifact set wholesale (pass every artifact you want; omit `--artifact` to leave them unchanged). The same artifact can be attached to multiple posts — it's a reusable, versioned creation, and each post renders its current revision. Create one with `gobi space artifacts create` (filed in the space) or `gobi personal artifacts create` (filed in your personal core) and attach it via `--artifact`. See the **gobi-artifact** skill.

> **Wiki-link uploads moved to artifacts.** The `--auto-attachments` flag that used to upload `[[wiki-linked files]]` from a post body now lives on `gobi personal artifacts create` / `gobi personal artifacts revise` (markdown kinds; there is no space-scoped artifact group). To publish a markdown creation with resolvable wikilinks, create a markdown artifact with `--vault-slug` + `--auto-attachments` and attach it to the post (`--post-id`). See the **gobi-artifact** skill. Before relying on wikilink resolution, confirm the anchor vault is published: `gobi --json vault status --vault-slug <slug>` should report `isPublished: true`.

## Post media + file attachments (`--attach`)

`posts create` and `posts reply` across both scopes (`gobi space`, `gobi personal`) accept `--attach <file>` (repeatable) for inline post attachments — photos/GIF/video that render in-feed alongside the post body, and document files that render as Slack-style file cards. The CLI uploads each file to S3 via `POST /posts/upload-url`; document files additionally carry `fileName` + `mimeType` on the row (the S3 key is a UUID, so that's the only place the original name survives).

**Anything that isn't an image or a video is a document file** — there is no allow-list to fall outside of. `pdf`/`md`/`txt`/`csv` preview in-app, `html`/`xhtml` opens in a browser tab (it's uploaded as real `text/html`, so it renders as a page rather than downloading), `docx` is download-only, and every other type (`.zip`, `.json`, source files, extension-less files) is a generic download card on the same 250MB tier.

Limit (enforced client-side before upload): **8 attachments per post**, with photos, GIFs, videos and document files mixing freely. Size ceilings: 10MB photos, 15MB GIFs, 512MB video, 250MB document files.

Use `--attach` for media/files you want shown in the post itself; use a markdown **artifact** (`gobi personal artifacts create`) for `[[wikilinks]]`-bearing creations attached to the post.

**Reading attachments back:** feed and list lines show a compact marker like `📎 2 photos, 1 file`; `posts get` prints an `Attachments (N):` block with one line per attachment — kind, original fileName, dimensions/MIME, and the fetchable CDN URL (artifact attachments show kind/title/artifactId instead). In `--json` mode the full `attachments` array is on every post/reply object.

## Public link formats

Once a post is created, you can build a shareable URL from the response:

- **Space post** — `https://www.gobispace.com/spaces/{spaceSlug}/posts/{publicId}`. Personal: `https://www.gobispace.com/personal/posts/{publicId}`. `publicId` is `p` + hex (or `r` + hex for replies).
- **Vault profile** — `https://gobispace.com/@{vaultSlug}`.
- **Vault file** — `https://gobispace.com/file/{vaultSlug}?path={path}` (e.g. `https://gobispace.com/file/jyk?path=notes/intro.md`). First-class URL for linking to a single file from a published vault — renders in the main feed chrome. Use this when a post body or reply needs to point readers at a specific vault file. URL-encode each path segment. See **gobi-vault** skill for full semantics.

When you echo a "Post created!" line (or the JSON response is consumed by another agent), include the assembled URL using the fields actually returned — `spaceSlug` + `publicId` (fall back to `id`) for space posts. Don't fabricate slugs.

## Prerequisites & space slug

`gobi space` commands only need a space slug, which can come from either:

1. `selectedSpaceSlug` in `.gobi/settings.yaml` (set via `gobi space warp`), or
2. A parent-level `--space-slug <slug>` flag passed at call time, which overrides `.gobi`:

   ```bash
   gobi space --space-slug <slug> posts list
   ```

If `.gobi/settings.yaml` has no `selectedSpaceSlug` and `--space-slug` isn't passed, the command will error.

`gobi personal` commands have no space requirement and no `.gobi` requirement. `gobi personal posts create` is symmetric with `gobi space posts create`: attach existing artifacts with `--artifact <artifactId>` (repeatable).

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **top-level** option (before the subcommand):

```bash
gobi --json space posts list
```

> Space and member administration (creating spaces, inviting/approving members, joining/leaving) is web-UI only and not available in the CLI.

## Available Commands

### Space details
- `gobi space get` — Get details for a space.
- `gobi space warp` — Select the active space.

### Post and reply identifiers

Feed, `posts list`, and `posts get` output print `publicId` (`p`/`r` + 10 hex, or legacy `p_`/`r_` + 16 hex) as `[p…]` / `[r…]`. Pass that token to `posts get`, `posts reply`, `posts react`, `--repost-post-id`, and the other post/reply commands. Spaces/vaults/bots use slugs. Users print and accept `u` + 10 hex (or legacy `u_`). Feeds print and accept `c` + 10 hex; DMs print and accept `d` + 10 hex. Mentions in `--rich-text` use `userId` set to that user's publicId (`u…`).

### Space posts and replies

A reply is a post with a parent, so both live under `posts`; every command that takes an id accepts `p…` (post) or `r…` (reply).

- `gobi space posts recent` — Posts and replies together, newest first (the feed as the app shows it).
- `gobi space posts list` — Root posts with their replies nested (paginated).
- `gobi space posts search <query>` — Search posts **and** replies, newest first. Free-text keywords plus a `from:<name>` (author) operator; quote multi-word values (`from:"Jane Doe"`). Each result is one post or reply, not a whole thread.
- `gobi space posts get <postId>` — A post or reply with its ancestors and replies (paginated). There is no separate `ancestors` or `list-replies` command.
- `gobi space posts create` — Create a post. `--artifact <artifactId>` (repeatable) attaches existing artifacts.
- `gobi space posts reply <postId>` — Reply to a post.
- `gobi space posts edit <id>` / `gobi space posts delete <id>` — Edit or delete a post or reply you authored. A reply takes no `--title`, `--attach` or `--artifact`.

`--feed <feedId>` on `recent`, `list`, `search` and `create` reads/writes one named feed instead of the main feed; `--all-feeds` on `recent` and `list` reads across all of them.

### Reactions

Emoji reactions on posts **and** replies, across both scopes (`gobi space`, `gobi personal`). The id is the `publicId` from the `[p…]`/`[r…]` tokens in feed output. Feed and `posts get` lines render existing reactions as compact chips like `👍2* 🎉1` — the count follows each emoji, and a trailing `*` marks ones you reacted with.

- `gobi space posts react <postId> <emoji>` — Add a reaction (idempotent; re-reacting with the same emoji is a no-op).
- `gobi space posts unreact <postId> <emoji>` — Remove your reaction. Pass the emoji literally (`gobi space posts unreact p0123456789 👍`).

### Feeds

Besides its main feed, a space has named, member-gated feeds. The **main feed is not listed** — `posts recent` / `posts list` / `posts create` without `--feed` target it, as always. Members see their own feeds; space owners/admins see all of them; the space agent sees only feeds with agent access enabled. Posting into a feed requires being able to see it. Feed administration (create, rename, delete, add/remove members, leave) is web-UI only — like space and member admin, the CLI deliberately doesn't expose it.

- `gobi space feeds list` — List feeds visible to you (shows member count, your membership, agent access).
- `gobi space feeds get <feedId>` — Get one feed's details.
- `gobi space feeds members <feedId>` — List a feed's members.
- `gobi personal feeds list` / `gobi personal feeds get <feedId>` — your personal space's own named feeds (you are their only member, so there is no `members`).

### Direct messages

Two scopes, different counterparties. DMs never appear in `feeds list` or `posts recent`.

- **Space** — talk to space members (humans), this space's bots (by botId), or personal bots registered in the space.
  - `gobi space dms list` — your conversations in the space, most recent first.
  - `gobi space dms open` — open the space's own bot (its oldest, when it has several).
  - `gobi space dms open --agent <botId>` — open one of this space's bots. Mutually exclusive with `--user`. A personal bot is its owner's alone and is never a party to a space.
  - `gobi space dms open --user <userId>` — open (or create) a conversation with one or more members (repeatable). Idempotent.
  - `gobi space dms send <dmId>` / `gobi space dms messages <dmId>` — write and read. Same `--content` / `--rich-text` / `--attach` as posts.
  - `gobi space dms sessions <dmId>` — a chat with a bot holds several sessions; `dms messages` reads the newest unless `--session <p…>` names one.
  - `gobi space agents list` / `add` / `remove` — list this space's bots (publicId `u…` on every row). Needs `--space-slug` like other space commands.
- **Personal** — talk to the user's personal bots. Omit `--agent` for their oldest bot.
  - `gobi personal dms list` / `gobi personal dms open [--agent <botId>]` / `gobi personal dms send <dmId>` / `gobi personal dms messages <dmId>`
  - `gobi personal agents list` / `add` / `remove` — list, add, or remove personal bots.
  - `dms open` is idempotent — safe to call before every send.

### Personal-space posts (private)

`gobi personal` posts and replies are scoped to a private personal space (`personalSpaceUserId`), with the same subcommand and write-flag shape as `gobi space`. Nothing here surfaces on any public feed — these posts are visible only to you. Use for private notes-as-posts, scratch drafts, or any post you don't want to make public.

One read-side flag doesn't mirror — `personal posts list` has no `--mine` (everything in the personal space is already yours).

Every `gobi space posts …` command above exists here too, with the same flags (`--feed` takes one of your personal feeds).

## Confirm before mutating

Space posts and replies are publicly visible — in a community space (`gobi space …`). `gobi personal …` is the exception: those rows are private to the author. Either way, before running any write, confirm with the user — show the exact command and the resolved title, content (or a short preview), and any attached artifact ids. This applies even when running autonomously.

- `posts create` / `posts reply` — content goes live on submission.
- `posts edit` — confirm the *new* content; people who already saw the original may re-see it.
- `posts delete` — irreversible. Flag that explicitly and confirm the target id before running.
- `posts react` / `posts unreact` are lightweight and reversible — when the user asked for the reaction, no extra confirmation needed.

- `dms send` — a message goes to the other party on submission; confirm content the same way as a reply.

Read-only commands (`posts list`, `posts get`, `posts recent`, `posts search`, `get`, `feeds list`, `feeds get`, `feeds members`, `dms list`, `dms messages`, `dms sessions`) run without confirmation.

## Reference Documentation

- [gobi space](references/space.md)
- [gobi personal](references/personal.md)

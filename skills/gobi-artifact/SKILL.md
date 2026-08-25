---
name: gobi-artifact
description: >-
  Gobi artifact commands for versioned creations attached to posts: create,
  revise, revert, history, download, delete, get, list. An artifact is a
  human-owned creation (image, video, gif, markdown, or note) whose revisions
  form a history tree, the newest of which is what the artifact reads as.
  Artifacts live in your personal core and are reached ONLY via
  `gobi personal artifact …` — there is no `gobi space artifact`. Share one into
  a space by attaching it to a post. Use when the user wants to author, version,
  or attach an artifact.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.5.16"
---

# gobi-artifact

Gobi artifact commands for versioned, post-attachable creations (v2.5.16).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## Scope: your personal core only

Artifacts live in your **personal core** (Home). There is exactly one group —
`gobi personal artifact …` — and no `gobi space artifact` equivalent: everything
Gobi captures, and everything generated from it, belongs to you rather than to a
space. A space is its channels and posts.

**To share an artifact with a space, attach it to a post:**

```bash
ARTIFACT=$(gobi --json personal artifact create --kind markdown --title "Spec" --file ./spec.md | jq -r .data.artifactId)
gobi space create-post --content "Draft spec — feedback welcome" --artifact "$ARTIFACT"
```

The post carries the artifact's current revision, so space members read it
through the post while the artifact itself stays in your Home. Revising it
updates every post it's attached to.

## What is an artifact?

An artifact is a versioned creation that can be attached to one or more posts. Each artifact has:

- **kind** — one of `image | video | gif | markdown | note`. `markdown` and `note` carry a markdown **body**; `image`, `gif`, and `video` carry an uploaded **media file**. `note` is markdown with a conventional frontmatter header (`title`, `source`, `start_time`, `end_time`, `duration`, `attendees`) that the backend mirrors into `metadata.note` on write so clients render a structured card; the keys are all optional.
- **title** — optional display title.
- **owner** — always a human (the calling user). Even when an agent runs the CLI, the artifact is owned by the agent's owner.
- **scope** — always your personal core; the one command group resolves no space slug, so the backend files it there.
- **revisions** — a history tree. The NEWEST revision is what the artifact reads as; writing one is what publishes it, and there is no separate publish step or draft state. `revise --from <revisionId>` branches off an earlier revision instead of the current one, so the history can fork.
- **metadata** — per-kind extras. For markdown kinds, `metadata.vaultSlug` is the anchor vault used to resolve `[[wikilinks]]` in the body.

Markdown bodies can reference vault notes with `[[wikilinks]]`. Resolution against the anchor vault (`--vault-slug` on create) only works for viewers who can read that vault.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **top-level** option (before everything else):

```bash
gobi --json personal artifact list --limit 20
gobi --json personal artifact create --kind markdown --content "# Notes" --title "My note"
gobi --json personal artifact get <artifactId>
```

JSON mode wraps the response as `{"success": true, "data": <artifact|revision|...>}` (or `{"success": false, "error": "..."}`).

## Typical Workflow (markdown artifact)

Create a markdown artifact, attaching it to a post in the same call:

```bash
gobi --json personal artifact create --kind markdown --file notes.md --title "Design notes" \
  --vault-slug my-vault --post-id 12345
```

The body can come from `--file <path>`, `--content <md>` inline, or stdin (`--content -`). `--vault-slug` anchors `[[wikilink]]` resolution and is stored as `metadata.vaultSlug`.

Add `--auto-attachments` (markdown kinds only) to upload any `[[wiki-linked files]]` in the body to the `--vault-slug` vault on webdrive before creating:

```bash
gobi --json personal artifact create --kind markdown --file notes.md --vault-slug my-vault --auto-attachments
```

Revise it — the new revision is live immediately:

```bash
gobi --json personal artifact revise <artifactId> --file notes-v2.md --change-note "Tighten intro"
```

`revise --auto-attachments` reuses the artifact's stored `metadata.vaultSlug` (it GETs the artifact first), so you don't repeat `--vault-slug`.

Inspect and roll back:

```bash
gobi --json personal artifact history <artifactId>          # full revision tree (owner only)
gobi --json personal artifact revert <artifactId> --to <revisionId>
```

## Typical Workflow (media artifact)

Image / gif / video kinds upload a local file (init → PUT → create) instead of a body:

```bash
gobi --json personal artifact create --kind image --file diagram.png --title "Architecture" --post-id 12345
```

Media-file size ceilings mirror post media: 10MB photos / 15MB GIFs / 512MB video, derived from the file's content type. Revise a media artifact by uploading a replacement file:

```bash
gobi --json personal artifact revise <artifactId> --file diagram-v2.png --change-note "Add cache layer"
```

## Download

`download` defaults to the artifact's current revision; pass `--revision` to pick one.

- markdown → writes the body to `--out <path>`, or prints to stdout when `--out` is omitted.
- media → fetches the `mediaUrl` bytes to `--out <path>` (defaults to `<artifactId>.<ext>`).

```bash
gobi personal artifact download <artifactId> --out notes.md
gobi personal artifact download <artifactId> --revision <revisionId> --out image.png
```

## Attaching to a post

Three ways to attach an artifact, depending on what already exists (`<lane>` is `personal` or `space` — the artifact commands themselves are `personal` only):

1. **At artifact-create time** — `gobi personal artifact create … --post-id <id>` attaches the new artifact to an existing post **without clobbering** its current artifacts: the CLI reads the post's current artifact attachments, appends the new id, and writes the merged set via `PATCH /posts/:id` (`artifactIds`).
2. **At post-create time** — `gobi <lane> create-post … --artifact <artifactId>` attaches one or more **already-created** artifacts to the new post (`--artifact` is repeatable).
3. **Editing an existing post** — `gobi <lane> edit-post <id> --artifact <artifactId>` sets the post's artifact attachments. Unlike `create --post-id` (which merges), the post API's `artifactIds` is a **full replacement** — pass every artifact you want on the post, since omitted ones are removed (omitting `--artifact` entirely leaves them unchanged).

The same artifact can be attached to **multiple posts** (it's a reusable, versioned creation — each post renders its current revision, so revising updates every post at once). Create it once, then reference its id via `--artifact` on each post.

## Available Commands

Under `gobi personal artifact …`:

- `create` — Create an artifact (markdown body or uploaded media). `--post-id` attaches it to a post; `--auto-attachments` (markdown) uploads `[[wikilinks]]`.
- `revise` — Edit the artifact: records a revision and makes it the current one (new body or media file). `--from` branches off a specific revision.
- `revert` — Restore an earlier revision's content as a new revision.
- `history` — List the full revision tree (owner only).
- `download` — Download a revision's content (markdown body or media bytes).
- `delete` — Delete an artifact and its revision tree.
- `get` — Get one artifact with its current revision.
- `list` — List your artifacts (`--kind`, `--limit`).

## Confirm before mutating

Artifacts are user-owned creations. The authoring commands (`create`, `revise`) are the normal flow and run without extra confirmation. Two commands change what's live or destroy data — confirm first:

- `revert <id> --to <id>` — replaces what the artifact says (visible on attached posts) with an earlier revision's content. Confirm the target revision with the user.
- `delete <id>` — irreversible (removes the artifact and its whole revision tree). Confirm the target id before running.

Read-only commands (`get`, `list`, `history`) and `download` run without confirmation.

## Reference Documentation

- [gobi personal artifact](references/personal.md)

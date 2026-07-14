---
name: gobi-artifact
description: >-
  Gobi artifact commands for versioned creations attached to posts: create,
  revise, publish, revert, history, download, delete, get, list. An artifact
  is a human-owned creation (image, video, gif, markdown, or meeting_summary)
  whose revisions form a draft/published tree. Artifacts are scoped to a space:
  `gobi personal artifact …` (your personal space) or `gobi space artifact …`
  (the active team space). Use when the user wants to author, version, publish,
  or attach an artifact to a post.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.41"
---

# gobi-artifact

Gobi artifact commands for versioned, post-attachable creations (v2.0.41).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## Scope: personal vs space

Artifacts live in a **space** — either your **personal space** or a **team space** —
just like posts. The commands are the same under each scope; pick the group that
matches where the artifact should live:

- `gobi personal artifact …` — your personal space (visible only to you).
- `gobi space artifact …` — the active team space (visible to its members). The
  space comes from `.gobi/settings.yaml` (set with `gobi space warp <slug>`) or
  `gobi space --space-slug <slug> artifact …`.

The examples below use `personal`; swap in `space` to operate on a team space.
The by-id subcommands (`revise`, `publish`, `revert`, `history`, `download`,
`delete`, `get`) work the same under either group — they're authorized off the
artifact itself — but keep using the same scope you created the artifact in.

## What is an artifact?

An artifact is a versioned creation that can be attached to one or more posts. Each artifact has:

- **kind** — one of `image | video | gif | markdown | meeting_summary`. `markdown` and `meeting_summary` carry a markdown **body**; `image`, `gif`, and `video` carry an uploaded **media file**.
- **title** — optional display title.
- **owner** — always a human (the calling user). Even when an agent runs the CLI, the artifact is owned by the agent's owner.
- **scope** — the personal space or team space it lives in (set by the command group, see above).
- **revisions** — a draft/published tree. New revisions start as `draft`; publishing one makes it the artifact's single `published` revision (at most one published per artifact). `revise --from <revisionId>` branches off an earlier revision instead of the latest, so the history can fork.
- **metadata** — per-kind extras. For markdown kinds, `metadata.vaultSlug` is the anchor vault used to resolve `[[wikilinks]]` in the body.

Markdown bodies can reference vault notes with `[[wikilinks]]`. Resolution against the anchor vault (`--vault-slug` on create) only works for viewers who can read that vault.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **top-level** option (before everything else):

```bash
gobi --json personal artifact list --limit 20
gobi --json personal artifact create --kind markdown --content "# Notes" --title "My note"
gobi --json space artifact get <artifactId>
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

Revise it (adds a new draft revision), then publish that revision:

```bash
gobi --json personal artifact revise <artifactId> --file notes-v2.md --change-note "Tighten intro"
gobi --json personal artifact publish <artifactId> --revision <revisionId>
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

Media-file size ceilings mirror post media: 5MB photos / 15MB GIFs / 512MB video, derived from the file's content type. Revise a media artifact by uploading a replacement file:

```bash
gobi --json personal artifact revise <artifactId> --file diagram-v2.png --change-note "Add cache layer"
```

## Download

`download` defaults to the artifact's current (published, else latest) revision; pass `--revision` to pick one.

- markdown → writes the body to `--out <path>`, or prints to stdout when `--out` is omitted.
- media → fetches the `mediaUrl` bytes to `--out <path>` (defaults to `<artifactId>.<ext>`).

```bash
gobi personal artifact download <artifactId> --out notes.md
gobi personal artifact download <artifactId> --revision <revisionId> --out image.png
```

## Attaching to a post

Three ways to attach an artifact, depending on what already exists (`<scope>` is `personal` or `space`):

1. **At artifact-create time** — `gobi <scope> artifact create … --post-id <id>` attaches the new artifact to an existing post **without clobbering** its current artifacts: the CLI reads the post's current artifact attachments, appends the new id, and writes the merged set via `PATCH /posts/:id` (`artifactIds`).
2. **At post-create time** — `gobi <lane> create-post … --artifact <artifactId>` attaches one or more **already-created** artifacts to the new post (`--artifact` is repeatable).
3. **Editing an existing post** — `gobi <lane> edit-post <id> --artifact <artifactId>` sets the post's artifact attachments. Unlike `create --post-id` (which merges), the post API's `artifactIds` is a **full replacement** — pass every artifact you want on the post, since omitted ones are removed (omitting `--artifact` entirely leaves them unchanged).

The same artifact can be attached to **multiple posts** (it's a reusable, versioned creation — each post renders its currently-published revision, so revising + publishing updates every post at once). Create it once, then reference its id via `--artifact` on each post.

## Available Commands

Under `gobi personal artifact …` (personal space) or `gobi space artifact …` (active team space):

- `create` — Create an artifact (markdown body or uploaded media). `--post-id` attaches it to a post; `--auto-attachments` (markdown) uploads `[[wikilinks]]`.
- `revise` — Add a draft revision (new body or media file). `--from` branches off a specific revision.
- `publish` — Publish a revision (becomes the single published revision).
- `revert` — Move the published pointer to an earlier revision.
- `history` — List the full revision tree (owner only).
- `download` — Download a revision's content (markdown body or media bytes).
- `delete` — Delete an artifact and its revision tree.
- `get` — Get one artifact with its current revision.
- `list` — List this scope's artifacts (`--kind`, `--limit`).

## Confirm before mutating

Artifacts are user-owned creations. The authoring commands (`create`, `revise`) are the normal flow and run without extra confirmation. Two commands change what's live or destroy data — confirm first:

- `publish <id> --revision <id>` / `revert <id> --to <id>` — change which revision is published (visible on attached posts). Confirm the target revision with the user.
- `delete <id>` — irreversible (removes the artifact and its whole revision tree). Confirm the target id before running.

Read-only commands (`get`, `list`, `history`) and `download` run without confirmation.

## Reference Documentation

- [gobi personal artifact](references/personal.md)
- [gobi space artifact](references/space.md)

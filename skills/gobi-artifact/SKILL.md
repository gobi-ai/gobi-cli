---
name: gobi-artifact
description: >-
  Gobi artifact commands for versioned creations attached to posts: create,
  revise, publish, revert, history, download, delete, get, list. An artifact
  is a human-owned creation (image, video, gif, markdown, or meeting_summary)
  whose revisions form a draft/published tree. Use when the user wants to
  author, version, publish, or attach an artifact to a post.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.28"
---

# gobi-artifact

Gobi artifact commands for versioned, post-attachable creations (v2.0.28).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## What is an artifact?

An artifact is a versioned creation that can be attached to one or more posts. Each artifact has:

- **kind** — one of `image | video | gif | markdown | meeting_summary`. `markdown` and `meeting_summary` carry a markdown **body**; `image`, `gif`, and `video` carry an uploaded **media file**.
- **title** — optional display title.
- **owner** — always a human (the calling user). Even when an agent runs the CLI, the artifact is owned by the agent's owner.
- **revisions** — a draft/published tree. New revisions start as `draft`; publishing one makes it the artifact's single `published` revision (at most one published per artifact). `revise --from <revisionId>` branches off an earlier revision instead of the latest, so the history can fork.
- **metadata** — per-kind extras. For markdown kinds, `metadata.vaultSlug` is the anchor vault used to resolve `[[wikilinks]]` in the body.

Markdown bodies can reference vault notes with `[[wikilinks]]`. Resolution against the anchor vault (`--vault-slug` on create) only works for viewers who can read that vault.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json artifact list --limit 20
gobi --json artifact create --kind markdown --content "# Notes" --title "My note"
gobi --json artifact get <artifactId>
```

JSON mode wraps the response as `{"success": true, "data": <artifact|revision|...>}` (or `{"success": false, "error": "..."}`).

## Typical Workflow (markdown artifact)

Create a markdown artifact, attaching it to a post in the same call:

```bash
gobi --json artifact create --kind markdown --file notes.md --title "Design notes" \
  --vault-slug my-vault --post-id 12345
```

The body can come from `--file <path>`, `--content <md>` inline, or stdin (`--content -`). `--vault-slug` anchors `[[wikilink]]` resolution and is stored as `metadata.vaultSlug`.

Add `--auto-attachments` (markdown kinds only) to upload any `[[wiki-linked files]]` in the body to the `--vault-slug` vault on webdrive before creating:

```bash
gobi --json artifact create --kind markdown --file notes.md --vault-slug my-vault --auto-attachments
```

Revise it (adds a new draft revision), then publish that revision:

```bash
gobi --json artifact revise <artifactId> --file notes-v2.md --change-note "Tighten intro"
gobi --json artifact publish <artifactId> --revision <revisionId>
```

`revise --auto-attachments` reuses the artifact's stored `metadata.vaultSlug` (it GETs the artifact first), so you don't repeat `--vault-slug`.

Inspect and roll back:

```bash
gobi --json artifact history <artifactId>          # full revision tree (owner only)
gobi --json artifact revert <artifactId> --to <revisionId>
```

## Typical Workflow (media artifact)

Image / gif / video kinds upload a local file (init → PUT → create) instead of a body:

```bash
gobi --json artifact create --kind image --file diagram.png --title "Architecture" --post-id 12345
```

Media-file size ceilings mirror post media: 5MB photos / 15MB GIFs / 512MB video, derived from the file's content type. Revise a media artifact by uploading a replacement file:

```bash
gobi --json artifact revise <artifactId> --file diagram-v2.png --change-note "Add cache layer"
```

## Download

`download` defaults to the artifact's current (published, else latest) revision; pass `--revision` to pick one.

- markdown → writes the body to `--out <path>`, or prints to stdout when `--out` is omitted.
- media → fetches the `mediaUrl` bytes to `--out <path>` (defaults to `<artifactId>.<ext>`).

```bash
gobi artifact download <artifactId> --out notes.md
gobi artifact download <artifactId> --revision <revisionId> --out image.png
```

## Attaching to a post

Three ways to attach an artifact, depending on what already exists:

1. **At artifact-create time** — `gobi artifact create … --post-id <id>` attaches the new artifact to an existing post **without clobbering** its current artifacts: the CLI reads the post's current artifact attachments, appends the new id, and writes the merged set via `PATCH /posts/:id` (`artifactIds`).
2. **At post-create time** — `gobi <lane> create-post … --artifact <artifactId>` attaches one or more **already-created** artifacts to the new post (`--artifact` is repeatable).
3. **Editing an existing post** — `gobi <lane> edit-post <id> --artifact <artifactId>` sets the post's artifact attachments. Unlike `create --post-id` (which merges), the post API's `artifactIds` is a **full replacement** — pass every artifact you want on the post, since omitted ones are removed (omitting `--artifact` entirely leaves them unchanged).

The same artifact can be attached to **multiple posts** (it's a reusable, versioned creation — each post renders its currently-published revision, so revising + publishing updates every post at once). Create it once, then reference its id via `--artifact` on each post.

## Available Commands

- `gobi artifact create` — Create an artifact (markdown body or uploaded media). `--post-id` attaches it to a post; `--auto-attachments` (markdown) uploads `[[wikilinks]]`.
- `gobi artifact revise` — Add a draft revision (new body or media file). `--from` branches off a specific revision.
- `gobi artifact publish` — Publish a revision (becomes the single published revision).
- `gobi artifact revert` — Move the published pointer to an earlier revision.
- `gobi artifact history` — List the full revision tree (owner only).
- `gobi artifact download` — Download a revision's content (markdown body or media bytes).
- `gobi artifact delete` — Delete an artifact and its revision tree.
- `gobi artifact get` — Get one artifact with its current revision.
- `gobi artifact list` — List your artifacts (`--kind`, `--limit`).

## Confirm before mutating

Artifacts are user-owned creations. The authoring commands (`create`, `revise`) are the normal flow and run without extra confirmation. Two commands change what's live or destroy data — confirm first:

- `publish <id> --revision <id>` / `revert <id> --to <id>` — change which revision is published (visible on attached posts). Confirm the target revision with the user.
- `delete <id>` — irreversible (removes the artifact and its whole revision tree). Confirm the target id before running.

Read-only commands (`get`, `list`, `history`) and `download` run without confirmation.

## Reference Documentation

- [gobi artifact](references/artifact.md)

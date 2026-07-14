---
name: gobi-vault
description: >-
  Gobi vault commands: initialize the vault for the current directory, list
  vaults you own, publish/unpublish PUBLISH.md, and run the local-to-webdrive
  sync. Use when the user wants to set up a vault, publish/unpublish it, or
  push/pull files.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.40"
---

# gobi-vault

Gobi vault commands for publishing your vault profile and syncing files (v2.0.40).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## Prerequisites

Most `gobi vault …` commands resolve the target vault from the current directory's `.gobi/settings.yaml` (specifically the `vaultSlug` entry); run `gobi vault init` first if it's missing.

Exceptions:
- `vault init`, `vault list`, `vault create <slug>` — no `.gobi` required.
- `vault delete <slug>` — slug is a positional, no `.gobi` fallback.
- `vault rename <newName>`, `vault status` — accept an optional `--vault-slug <slug>` to target a vault other than the one in `.gobi`.

## Gobi Vault

A "vault" is your file-backed knowledge home. Public vaults are accessible at `https://gobispace.com/@{vaultSlug}`. Each vault has a profile written to `PUBLISH.md` at its root; publishing pushes that file to webdrive, which then updates vault metadata and the public profile.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **top-level** option (before the subcommand):

```bash
gobi --json vault publish
```

## Available Commands

- `gobi vault init` — Interactive: select an existing vault or create a new one. Writes `vaultSlug` to `.gobi/settings.yaml` in the current directory and seeds `PUBLISH.md`. Requires the user to be logged in (`gobi auth login`).
- `gobi vault list` — List vaults you own.
- `gobi vault status` — Show the configured vault's publish state (`isPublished`), profile fields (`title`, `description`, `tags`), referenced files (`thumbnailPath`, `homepagePath`, `promptPath`), file count, and the public profile URL. Use this as a diagnostic before authoring a markdown artifact with `--auto-attachments` (see gobi-artifact skill) to confirm the vault is public — files uploaded to a non-public vault are stored on webdrive but are not visible at `gobispace.com/@{vaultSlug}` until you run `gobi vault publish`.
- `gobi vault create <slug> --name <name>` — Create a new vault with the given slug and display name. Slug must be unique (use `vault list` to see what's taken). Does not change the configured vault — run `vault init` here afterwards if you want to anchor to it.
- `gobi vault rename <newName>` — Rename the configured vault's display name. Pass `--vault-slug <slug>` to target another vault. Local handle only — the public profile title comes from `PUBLISH.md` frontmatter and is unaffected.
- `gobi vault delete <slug>` — Delete a vault. Irreversible. Required arg, no `.gobi` fallback. The API will reject if the vault still owns content; clean up posts, members, and files first.
- `gobi vault publish` — Upload `PUBLISH.md` to the vault root on webdrive. Triggers post-processing (vault profile sync, metadata update). If `PUBLISH.md` is missing (e.g. a legacy vault that only has `BRAIN.md`), a starter `PUBLISH.md` is scaffolded locally and **nothing is pushed** — fill in at least `title` and `description`, then re-run.
- `gobi vault unpublish` — Delete `PUBLISH.md` from the vault on webdrive.
- `gobi vault sync` — Sync local vault files with Gobi Webdrive. Supports `--upload-only`, `--download-only`, `--conflict <ask|server|client|skip>`, `--dry-run`, `--full`, `--path <p>`, `--plan-file`, `--execute`.

## Public link formats

Once a vault is published (i.e. `gobi vault status` reports `isPublished: yes`), it is reachable at predictable URLs:

- **Vault profile** — `https://gobispace.com/@{vaultSlug}` (e.g. `https://gobispace.com/@jyk`).
- **Direct link to a vault file** — `https://gobispace.com/file/{vaultSlug}?path={path}` (e.g. `https://gobispace.com/file/jyk?path=notes/intro.md`). This is the first-class URL for sharing a single file from a vault — use it whenever you want a reader to land on one specific file. The page renders inside the main feed chrome (sidebar + header), so readers stay in `gobispace.com` instead of pivoting to the vault homepage. Paths without an extension are treated as markdown (the same wikilink-stem resolution webdrive uses), so `?path=intro` and `?path=intro.md` both resolve. URL-encode each path segment when assembling.
- **Custom homepage** — when `homepage` is set in `PUBLISH.md` frontmatter, the vault profile URL renders that HTML file. See **gobi-homepage** skill.

When linking to a vault file, assemble the URL from concrete fields (the vault's `vaultSlug` + the file's path) rather than guessing.

## Confirm before mutating

Every command in this skill writes external state — webdrive files and the public vault profile. Before running any of them, confirm with the user — show the exact command and the key changes (which `PUBLISH.md` fields, which paths will sync, which conflict policy). This applies even when running autonomously.

- `vault publish` — public profile change. Always confirm.
- `vault unpublish` — removes the live profile. Always confirm.
- `vault sync` — can overwrite remote or local files. Run `--dry-run` first and show the user the plan before re-running without `--dry-run`. With `--conflict server` or `--conflict client`, name which side is going to be overwritten.
- `vault delete <slug>` — irreversible; cannot undo. Confirm the slug and that the user actually means to delete *that* vault before running.
- `vault create` / `vault rename` — creating spends a slug permanently; renaming is reversible but visible. Show the user the resolved slug + name before running.

## PUBLISH.md Frontmatter Reference

`PUBLISH.md` is the metadata file at the root of every vault. Its YAML frontmatter controls the vault's public profile, homepage, and AI agent behavior. Example:

```yaml
---
title: My Vault
tags:
  - topic1
  - topic2
description: A short description of what this vault is about.
thumbnail: "[[PROFILE.png]]"
homepage: "[[app/home.html?nav=false]]"
prompt: "[[system-prompt.md]]"
---
```

### Fields

- **`title`** (required) — Display name of the vault.
- **`description`** (required for public listing) — Short description shown on the vault card and public profile. Without both `title` and `description`, the vault won't appear in the public catalog.
- **`tags`** — Tags for categorization and discovery. Supports YAML block list or inline array format:
  ```yaml
  # Block list
  tags:
    - ambient ai
    - wearables

  # Inline array
  tags: [ambient ai, wearables]
  ```
- **`thumbnail`** — Profile image for the vault card. Uses wiki-link syntax pointing to an image file in the vault (e.g. `"[[PROFILE.png]]"`).
- **`homepage`** — Custom HTML page to serve as the vault's public homepage at `gobispace.com/@{vaultSlug}`. Uses wiki-link syntax pointing to an HTML file in the vault. Supports a `nav` query parameter to control Gobi's sidebar navigation:
  - `"[[app/home.html]]"` — Shows the Gobi sidebar alongside the homepage (default)
  - `"[[app/home.html?nav=false]]"` — Full-screen, no Gobi sidebar/chrome
- **`prompt`** — Wiki-link to a custom system prompt file for the vault's AI agent (e.g. `"[[system-prompt.md]]"`).

> For details on building custom HTML homepages and using the `window.gobi` API, see the **gobi-homepage** skill.

## Publishing Workflow

After editing `PUBLISH.md` frontmatter, follow these steps to make your changes live:

1. **Edit `PUBLISH.md`** in the vault root with the desired frontmatter fields.
2. **Sync referenced files** — if the homepage HTML, thumbnail image, or prompt file is new or updated, upload them first:
   ```bash
   gobi vault sync
   ```
3. **Publish the vault**:
   ```bash
   gobi vault publish
   ```
   This uploads `PUBLISH.md` to webdrive, triggers post-processing that extracts metadata (title, description, tags, thumbnail, homepage path), and updates the vault's public profile.
4. The vault is now live at `https://gobispace.com/@{vaultSlug}`.

> **Important:** Any time you change `PUBLISH.md` frontmatter (e.g. adding or updating `homepage`), you must re-run `gobi vault publish` for the changes to take effect.

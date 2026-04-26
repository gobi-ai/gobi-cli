---
name: gobi-brain
description: >-
  Gobi brain commands for knowledge management: search public brains by text
  and semantic similarity, ask brains questions, publish/unpublish BRAIN.md,
  and manage brain updates (post/edit/delete). Use when the user wants to
  search knowledge, ask a brain, publish their brain document, or manage
  their brain updates. To browse the global feed of brain updates from
  others, see the gobi-feed skill.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "0.8.0"
---

# gobi-brain

Gobi brain commands for knowledge management (v0.8.0).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## Gobi Brain — Knowledge Management

`gobi brain` commands manage your vault's brain: search across all spaces, ask brains questions, and publish/unpublish your BRAIN.md. Public brains are accessible at `https://gobispace.com/@{vaultSlug}`.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json brain search --query "machine learning"
```

## Available Commands

- `gobi brain search` — Search public brains by text and semantic similarity.
- `gobi brain ask` — Ask a brain a question. Creates a targeted session (1:1 conversation).
- `gobi brain publish` — Upload BRAIN.md to the vault root on webdrive. Triggers post-processing (brain sync, metadata update, Discord notification).
- `gobi brain unpublish` — Delete BRAIN.md from the vault on webdrive.
- `gobi brain post-update` — Post a brain update for a vault.
- `gobi brain edit-update` — Edit a published brain update. You must be the author.
- `gobi brain delete-update` — Delete a published brain update. You must be the author.

## BRAIN.md Frontmatter Reference

`BRAIN.md` is the metadata file at the root of every vault. Its YAML frontmatter controls the vault's public profile, homepage, and AI agent behavior. Example:

```yaml
---
title: My Brain
tags:
  - topic1
  - topic2
description: A short description of what this brain is about.
thumbnail: "[[BRAIN.png]]"
homepage: "[[app/home.html?nav=false]]"
prompt: "[[system-prompt.md]]"
---
```

### Fields

- **`title`** (required) — Display name of the brain/vault.
- **`description`** (required for public listing) — Short description shown on the brain card and public profile. Without both `title` and `description`, the brain won't appear in the public catalog.
- **`tags`** — Tags for categorization and discovery. Supports YAML block list or inline array format:
  ```yaml
  # Block list
  tags:
    - ambient ai
    - wearables

  # Inline array
  tags: [ambient ai, wearables]
  ```
- **`thumbnail`** — Profile image for the brain card. Uses wiki-link syntax pointing to an image file in the vault (e.g. `"[[BRAIN.png]]"`).
- **`homepage`** — Custom HTML page to serve as the vault's public homepage at `gobispace.com/@{vaultSlug}`. Uses wiki-link syntax pointing to an HTML file in the vault. Supports a `nav` query parameter to control Gobi's sidebar navigation:
  - `"[[app/home.html]]"` — Shows the Gobi sidebar alongside the homepage (default)
  - `"[[app/home.html?nav=false]]"` — Full-screen, no Gobi sidebar/chrome
- **`prompt`** — Wiki-link to a custom system prompt file for the brain's AI agent (e.g. `"[[system-prompt.md]]"`).

> For details on building custom HTML homepages and using the `window.gobi` API, see the **gobi-homepage** skill.

## Publishing Workflow

After editing `BRAIN.md` frontmatter, follow these steps to make your changes live:

1. **Edit `BRAIN.md`** in the vault root with the desired frontmatter fields.
2. **Sync referenced files** — if the homepage HTML, thumbnail image, or prompt file is new or updated, upload them first:
   ```bash
   gobi sync
   ```
3. **Publish the brain**:
   ```bash
   gobi brain publish
   ```
   This uploads `BRAIN.md` to webdrive, triggers post-processing that extracts metadata (title, description, tags, thumbnail, homepage path), updates the vault's public profile, and sends a Discord notification.
4. The vault is now live at `https://gobispace.com/@{vaultSlug}`.

> **Important:** Any time you change `BRAIN.md` frontmatter (e.g. adding or updating `homepage`), you must re-run `gobi brain publish` for the changes to take effect.

## Reference Documentation

- [gobi brain](references/brain.md)

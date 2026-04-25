---
name: gobi-vault
description: >-
  Gobi vault commands for knowledge management: search public vaults by text
  and semantic similarity, ask vaults questions, and publish/unpublish
  BRAIN.md. Use when the user wants to search knowledge, ask a vault, or
  publish their vault document.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "1.0.0"
---

# gobi-vault

Gobi vault commands for knowledge management (v1.0.0).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## Gobi Vault — Knowledge Management

`gobi vault` commands manage your vault: search public vaults, ask them questions, and publish/unpublish your `BRAIN.md`. Public vaults are accessible at `https://gobispace.com/@{vaultSlug}`.

> **Vault updates have moved to threads.** To post user-level content, use `gobi global create-thread` (platform-wide global) or `gobi space create-thread` (a specific space). See the **gobi-space** skill.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json vault search --query "machine learning"
```

## Available Commands

- `gobi vault search` — Search public vaults by text and semantic similarity.
- `gobi vault ask` — Ask a vault a question. Creates a targeted session (1:1 conversation).
- `gobi vault publish` — Upload BRAIN.md to the vault root on webdrive. Triggers post-processing (vault sync, metadata update, Discord notification).
- `gobi vault unpublish` — Delete BRAIN.md from the vault on webdrive.

## BRAIN.md Frontmatter Reference

`BRAIN.md` is the metadata file at the root of every vault. Its YAML frontmatter controls the vault's public profile, homepage, and AI agent behavior. Example:

```yaml
---
title: My Vault
tags:
  - topic1
  - topic2
description: A short description of what this vault is about.
thumbnail: "[[BRAIN.png]]"
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
- **`thumbnail`** — Profile image for the vault card. Uses wiki-link syntax pointing to an image file in the vault (e.g. `"[[BRAIN.png]]"`).
- **`homepage`** — Custom HTML page to serve as the vault's public homepage at `gobispace.com/@{vaultSlug}`. Uses wiki-link syntax pointing to an HTML file in the vault. Supports a `nav` query parameter to control Gobi's sidebar navigation:
  - `"[[app/home.html]]"` — Shows the Gobi sidebar alongside the homepage (default)
  - `"[[app/home.html?nav=false]]"` — Full-screen, no Gobi sidebar/chrome
- **`prompt`** — Wiki-link to a custom system prompt file for the vault's AI agent (e.g. `"[[system-prompt.md]]"`).

> For details on building custom HTML homepages and using the `window.gobi` API, see the **gobi-homepage** skill.

## Publishing Workflow

After editing `BRAIN.md` frontmatter, follow these steps to make your changes live:

1. **Edit `BRAIN.md`** in the vault root with the desired frontmatter fields.
2. **Sync referenced files** — if the homepage HTML, thumbnail image, or prompt file is new or updated, upload them first:
   ```bash
   gobi sync
   ```
3. **Publish the vault**:
   ```bash
   gobi vault publish
   ```
   This uploads `BRAIN.md` to webdrive, triggers post-processing that extracts metadata (title, description, tags, thumbnail, homepage path), updates the vault's public profile, and sends a Discord notification.
4. The vault is now live at `https://gobispace.com/@{vaultSlug}`.

> **Important:** Any time you change `BRAIN.md` frontmatter (e.g. adding or updating `homepage`), you must re-run `gobi vault publish` for the changes to take effect.

## Reference Documentation

- [gobi vault](references/vault.md)

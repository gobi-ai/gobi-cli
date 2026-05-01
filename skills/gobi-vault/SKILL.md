---
name: gobi-vault
description: >-
  Gobi vault commands for publishing your vault profile and syncing files:
  publish/unpublish PUBLISH.md and run the local-to-webdrive sync. Use when
  the user wants to publish their vault, unpublish it, or push/pull files.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "0.9.13"
---

# gobi-vault

Gobi vault commands for publishing your vault profile and syncing files (v0.9.13).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## Gobi Vault

A "vault" is your file-backed knowledge home. Public vaults are accessible at `https://gobispace.com/@{vaultSlug}`. Each vault has a profile written to `PUBLISH.md` at its root; publishing pushes that file to webdrive, which then updates vault metadata and the public profile.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json vault publish
```

## Available Commands

- `gobi vault publish` — Upload `PUBLISH.md` to the vault root on webdrive. Triggers post-processing (vault profile sync, metadata update, Discord notification).
- `gobi vault unpublish` — Delete `PUBLISH.md` from the vault on webdrive.
- `gobi vault sync` — Sync local vault files with Gobi Webdrive. Supports `--upload-only`, `--download-only`, `--conflict <ask|server|client|skip>`, `--dry-run`, `--full`, `--path <p>`, `--plan-file`, `--execute`.

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
   This uploads `PUBLISH.md` to webdrive, triggers post-processing that extracts metadata (title, description, tags, thumbnail, homepage path), updates the vault's public profile, and sends a Discord notification.
4. The vault is now live at `https://gobispace.com/@{vaultSlug}`.

> **Important:** Any time you change `PUBLISH.md` frontmatter (e.g. adding or updating `homepage`), you must re-run `gobi vault publish` for the changes to take effect.

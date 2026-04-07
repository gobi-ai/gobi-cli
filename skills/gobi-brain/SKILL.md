---
name: gobi-brain
description: >-
  Gobi brain commands for knowledge management: search public brains by text
  and semantic similarity, ask brains questions, publish/unpublish BRAIN.md,
  and manage brain updates (list/post/edit/delete). Use when the user wants
  to search knowledge, ask a brain, publish their brain document, or manage
  brain updates.
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

## Space Slug Override

For `gobi brain list-updates`, you can filter by space with a subcommand option:

```bash
gobi brain list-updates --space-slug <slug>
```

Note: `--space-slug` is not available on other `brain` subcommands.

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
- `gobi brain list-updates` — List recent brain updates. Without --space-slug, lists all updates for you. With --space-slug, lists updates for that space. Use --mine to show only updates by you.
- `gobi brain post-update` — Post a brain update for a vault.
- `gobi brain edit-update` — Edit a published brain update. You must be the author.
- `gobi brain delete-update` — Delete a published brain update. You must be the author.

## Reference Documentation

- [gobi brain](references/brain.md)

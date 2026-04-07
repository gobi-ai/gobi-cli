---
name: gobi-sense
description: >-
  Gobi sense commands for activity and transcription data: fetch activity
  records and transcription records within a time range. Use when the user
  wants to review their activities or transcriptions from Gobi Sense.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "0.8.0"
---

# gobi-sense

Gobi sense commands for activity and transcription data (v0.8.0).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json sense activities --from 2024-01-01 --to 2024-01-31
```

## Available Commands

- `gobi sense activities` — Fetch activity records within a time range.
- `gobi sense transcriptions` — Fetch transcription records within a time range.

## Reference Documentation

- [gobi sense](references/sense.md)

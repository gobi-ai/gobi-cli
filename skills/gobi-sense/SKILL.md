---
name: gobi-sense
description: >-
  Gobi sense commands for activity and transcription data: list activity
  records and list transcription records within a time range. Use when the
  user wants to review their activities or transcriptions from Gobi Sense.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "2.0.22"
---

# gobi-sense

Gobi sense commands for activity and transcription data (v2.0.22).

Requires gobi-cli installed and authenticated. See the **gobi-core** skill for setup.

Activities and transcriptions are captured by Gobi Sense (the wearable) and the mobile app, then ingested via the cloud pipeline. The CLI surface is read-only — fetch records in a time range and feed them to whatever analysis you want to run.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json sense list-activities --start-time 2026-04-01T00:00:00Z --end-time 2026-04-08T00:00:00Z
```

Times are ISO 8601 UTC.

## Available Commands

- `gobi sense list-activities` — List activity records within a time range.
- `gobi sense list-transcriptions` — List transcription records within a time range.

## Reference Documentation

- [gobi sense](references/sense.md)

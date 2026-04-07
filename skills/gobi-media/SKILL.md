---
name: gobi-media
description: >-
  Gobi media generation: generate images from text prompts (thumbnails,
  assets, logos), edit and inpaint images, create avatar videos with voice
  narration, list available avatars and voices, upload media files. Use when
  the user wants to generate images, create videos, or manage media.
allowed-tools: Bash(gobi:*)
metadata:
  author: gobi-ai
  version: "0.8.0"
---

# gobi-media

Gobi media generation commands (v0.8.0).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json media image-generate --prompt "a sunset over mountains"
```

## Typical Workflow (Image Generation)

Always follow this two-step flow — generate, then download to vault:

```bash
# Step 1: Generate (use --wait to poll until complete)
gobi --json media image-generate --prompt "a sunset over mountains" --wait
# → returns JSON with jobId

# Step 2: Download to vault media/ folder
gobi --json media image-download <jobId> -o media/<name>.png
```

Then show the result as an embedded vault link: `![[media/<name>.png]]`

### Key rules
- `--name` is **optional** — auto-derived from prompt if omitted.
- `--wait` avoids needing a separate `image-status` call.
- Always download with `-o media/<name>.png` — pick a short descriptive name (e.g., `happy-family.png`).
- `image-status` takes a **positional** jobId (NOT `--job-id`): `gobi media image-status <jobId>`

## Available Commands

### Upload

- `gobi media upload-init` — Get a presigned upload URL for a media file.
- `gobi media upload-finalize` — Confirm that a media upload is complete.

### Avatars & Voices

- `gobi media avatars` — List available avatars.
- `gobi media voices` — List available voices.

### Videos

- `gobi media video-create` — Create an avatar video generation job.
- `gobi media video-list` — List all videos.
- `gobi media video-get` — Get video metadata.
- `gobi media video-status` — Poll video generation status.
- `gobi media video-download` — Get the download URL for a completed video.

### Images

- `gobi media image-generate` — Generate an image from a text prompt. Types: image (default), thumbnail (YouTube-optimized), asset (logo/product). Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4
- `gobi media image-edit` — Edit an existing image with a prompt (image-to-image).
- `gobi media image-inpaint` — Inpaint an image region using a mask.
- `gobi media image-status` — Check image generation job status.

## Reference Documentation

- [gobi media](references/media.md)

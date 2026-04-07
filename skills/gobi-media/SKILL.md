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

Single command — generate and download in one step:

```bash
gobi --json media image-generate --prompt "<PROMPT>" -o media/<NAME>.png
```

Replace `<NAME>` with a short descriptive slug derived from the prompt (e.g., `happy-family`, `sunset-mountains`).

The `-o` flag implies `--wait` and downloads the image when done.

**IMPORTANT: After downloading, show the image using Obsidian wiki-link syntax EXACTLY like this:**

```
![[media/<NAME>.png]]
```

Do NOT use markdown image syntax `![](...)` or `gobi://` URLs. Always use `![[media/<NAME>.png]]`.

### Key rules
- Replace `<NAME>` with a descriptive slug — NEVER use example names like `sunset.png` literally.
- `--name` is **optional** — auto-derived from prompt if omitted.
- Do NOT use the `downloadUrl` from the response — it is a frontend path, not a direct download link.
- `image-download` takes a **positional** jobId (NOT `--job-id`): `gobi media image-download <jobId>`
- The `jobId` (or `id`) field is what you pass to `image-download` / `image-status` — NOT `mediaId`.

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

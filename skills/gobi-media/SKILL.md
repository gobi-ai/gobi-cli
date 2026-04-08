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
gobi --json media image-generate --prompt "<PROMPT>" --aspect-ratio "<RATIO>" -o media/<NAME>.png
```

Replace `<NAME>` with a short descriptive slug derived from the prompt (e.g., `happy-family`, `sunset-mountains`).
Replace `<RATIO>` with the desired aspect ratio: `1:1`, `16:9`, `9:16`, `4:3`, or `3:4`. Use `9:16` for Shorts/Reels.

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

## Typical Workflow (Video Generation)

Single command — create and download in one step:

```bash
gobi --json media video-create --avatar-id "<AVATAR_ID>" --voice-id "<VOICE_ID>" --script "<SCRIPT>" -o media/<NAME>.mp4
```

`--name` is optional (auto-generated if omitted). Replace `<NAME>` with a short descriptive slug. Use `gobi media avatars` and `gobi media voices` to list available IDs.

The `-o` flag implies `--wait` and downloads the video when done.

**IMPORTANT: Avatars are pre-built system avatars ONLY.** You CANNOT create custom avatars from uploaded images. The `gobi media avatars` list is the complete set of available avatars. Do NOT attempt to upload an image and use its mediaId as an avatarId — it will fail.

To use a custom image (e.g. a generated image) as the **background** of a video, upload it first via `upload-init` / `upload-finalize`, then pass the mediaId as `--background-media-id`:

```bash
# 1. Upload custom image as background
gobi --json media upload-init --file-name "bg.png" --content-type "image/png" --file-size <SIZE>
curl -T "media/bg.png" -H "Content-Type: image/png" "<UPLOAD_URL>"
gobi --json media upload-finalize --media-id "<MEDIA_ID>"

# 2. Create video with pre-built avatar + custom background
gobi --json media video-create --avatar-id "<AVATAR_ID>" --voice-id "<VOICE_ID>" --script "<SCRIPT>" --background-media-id "<MEDIA_ID>" -o media/<NAME>.mp4
```

**IMPORTANT: After downloading, show the video using Obsidian wiki-link syntax EXACTLY like this:**

```
![[media/<NAME>.mp4]]
```

Do NOT use markdown image/link syntax `![](...)` or `gobi://` URLs. Always use `![[media/<NAME>.mp4]]`.

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
- `gobi media video-download` — Download a completed video (`-o` to save to file).

### Images

- `gobi media image-generate` — Generate an image from a text prompt. Types: image (default), thumbnail (YouTube-optimized), asset (logo/product). Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4
- `gobi media image-edit` — Edit an existing image with a prompt (image-to-image).
- `gobi media image-inpaint` — Inpaint an image region using a mask.
- `gobi media image-status` — Check image generation job status.

## Reference Documentation

- [gobi media](references/media.md)

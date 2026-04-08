---
name: gobi-media
description: >-
  Gobi media generation: generate images from text prompts (thumbnails,
  assets, logos), edit and inpaint images, create avatar videos with voice
  narration, create cinematic videos from prompts, design custom avatars or
  create avatars from selfies, list available avatars and voices, upload
  media files. Use when the user wants to generate images, create videos,
  or manage media.
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

To use a custom image as the **background** of a video, pass it directly as `--background <file>` (auto-uploaded):

```bash
gobi --json media video-create --avatar-id "<AVATAR_ID>" --voice-id "<VOICE_ID>" --script "<SCRIPT>" --background media/bg.png -o media/<NAME>.mp4
```

## Typical Workflow (Cinematic Video)

Generate a cinematic video from a text prompt (no avatar needed):

```bash
gobi --json media cinematic-create --prompt "<PROMPT>" --aspect-ratio "<RATIO>" -o media/<NAME>.mp4
```

Options: `--duration <4-8>`, `--resolution <720p|1080p>`, `--enhance-prompt`, `--generate-audio`, `--negative-prompt`, `--sample-count <1-4>`, `--first-frame <file>`, `--last-frame <file>`, `--reference-images <files>`.

## Typical Workflow (Image Editing)

Edit an existing image with a prompt — single command:

```bash
gobi --json media image-edit --image media/source.png --prompt "<EDIT_INSTRUCTION>" -o media/<NAME>.png
```

All file arguments (`--image`, `--mask`, `--background`, `--photo`, `--audio`, `--reference-image`, `--first-frame`, `--last-frame`) accept local file paths and auto-upload them. No need to manually upload first.

## Custom Avatars

Three ways to create custom avatars:

### 1. Design from scratch

```bash
gobi --json media avatar-design --gender "<GENDER>" --age "<AGE>" --ethnicity "<ETHNICITY>" --outfit "<OUTFIT>" --background "<BACKGROUND>" --wait
```

When `variants_ready`, confirm with:

```bash
gobi --json media avatar-confirm --job-id "<JOB_ID>"
```

### 2. From a selfie (instant)

```bash
gobi --json media avatar-from-selfie --photo media/selfie.png
```

### 3. From a selfie (enhanced with prompt)

```bash
gobi --json media avatar-from-selfie --photo media/selfie.png --prompt "<ENHANCEMENT>" --wait
```

Check any avatar job status with:

```bash
gobi --json media avatar-job-status <jobId> --wait
```

**IMPORTANT: After downloading, show the video using Obsidian wiki-link syntax EXACTLY like this:**

```
![[media/<NAME>.mp4]]
```

Do NOT use markdown image/link syntax `![](...)` or `gobi://` URLs. Always use `![[media/<NAME>.mp4]]`.

## Available Commands

### Upload

- `gobi media upload <file>` — Upload a local file and return its media ID. Content type is auto-detected.

### Avatars & Voices

- `gobi media avatars` — List available avatars.
- `gobi media voices` — List available voices.

### Videos

- `gobi media video-create` — Create an avatar video generation job.
- `gobi media cinematic-create` — Create a cinematic video from a text prompt.
- `gobi media video-list` — List all videos.
- `gobi media video-get` — Get video metadata.
- `gobi media video-status` — Poll video generation status.
- `gobi media video-download` — Download a completed video (`-o` to save to file).

### Custom Avatars

- `gobi media avatar-design` — Start a design-your-avatar job.
- `gobi media avatar-confirm` — Confirm avatar variant(s) after design.
- `gobi media avatar-from-selfie` — Create an avatar from a selfie (instant or enhanced).
- `gobi media avatar-job-status` — Check avatar job status.

### Images

- `gobi media image-generate` — Generate an image from a text prompt. Types: image (default), thumbnail (YouTube-optimized), asset (logo/product). Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4
- `gobi media image-edit` — Edit an existing image with a prompt (image-to-image).
- `gobi media image-inpaint` — Inpaint an image region using a mask.
- `gobi media image-status` — Check image generation job status.

## Reference Documentation

- [gobi media](references/media.md)

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
  version: "2.0.27"
---

# gobi-media

Gobi media generation commands (v2.0.27).

Requires gobi-cli installed and authenticated. See gobi-core skill for setup.

## Important: JSON Mode

For programmatic/agent usage, always pass `--json` as a **global** option (before the subcommand):

```bash
gobi --json media generate-image --prompt "a sunset over mountains"
```

## Typical Workflow (Image Generation)

Single command — generate and download in one step:

```bash
gobi --json media generate-image --prompt "<PROMPT>" --aspect-ratio "<RATIO>" -o media/<NAME>.png
```

Replace `<NAME>` with a short descriptive slug derived from the prompt (e.g., `happy-family`, `sunset-mountains`).
Replace `<RATIO>` with the desired aspect ratio: `1:1`, `16:9`, `9:16`, `4:3`, or `3:4`. Use `9:16` for Shorts/Reels.

The `-o` flag implies `--wait` and downloads the image when done.

**Where you reference the downloaded file depends on the surface you're rendering to:**

- **Chat / vault note (vault is mounted, ![[wikilinks]] resolve):** use Obsidian wiki-link syntax:
  ```
  ![[media/<NAME>.png]]
  ```
- **Post or reply you're authoring with the CLI** (`gobi <scope> create-post` / `create-reply`): do NOT embed the image in `--content`. Pass the file as a first-class attachment:
  ```bash
  gobi space create-post --title "<TITLE>" --content "<BODY>" --attach media/<NAME>.png
  gobi space create-reply <postId> --content "<BODY>" --attach media/<NAME>.png
  ```
  This uploads to the CDN and renders the image as a slider on the post card. `--attach` is repeatable; mix rule is **4 photos OR 1 GIF OR 1 video**.
- **Post-mention reply** (you were `@`-mentioned on a thread — `@gobi` / `@space:<slug>` — and your assistant body is auto-posted as the reply): **just write the text reply. Do not include the image as wiki-link, markdown image, or any URL.** The runtime detects every `gobi media generate-image` call you ran this turn and attaches those images to your auto-posted reply automatically. Embedding the image yourself either dangles (the workspace path doesn't resolve publicly) or duplicates the slider.

### Key rules
- Replace `<NAME>` with a descriptive slug — NEVER use example names like `sunset.png` literally.
- `--name` is **optional** — auto-derived from prompt if omitted.
- Do NOT use the `downloadUrl` from the response — it is an internal backend path, not a public link. Always download with `-o` then either wiki-link (chat/vault), `--attach` (CLI-authored post/reply), or nothing (post-mention auto-post — the runtime attaches).
- `download-image` takes a **positional** jobId (NOT `--job-id`): `gobi media download-image <jobId>`
- The `jobId` (or `id`) field is what you pass to `download-image` / `get-image-status` — NOT `mediaId`.

## Typical Workflow (Video Generation)

Single command — create and download in one step:

```bash
gobi --json media create-video --avatar-id "<AVATAR_ID>" --voice-id "<VOICE_ID>" --script "<SCRIPT>" -o media/<NAME>.mp4
```

`--name` is optional (auto-generated if omitted). Replace `<NAME>` with a short descriptive slug. Use `gobi media list-avatars` and `gobi media list-voices` to list available IDs.

The `-o` flag implies `--wait` and downloads the video when done.

To use a custom image as the **background** of a video, pass it directly as `--background <file>` (auto-uploaded):

```bash
gobi --json media create-video --avatar-id "<AVATAR_ID>" --voice-id "<VOICE_ID>" --script "<SCRIPT>" --background media/bg.png -o media/<NAME>.mp4
```

## Typical Workflow (Cinematic Video)

Generate a cinematic video from a text prompt (no avatar needed):

```bash
gobi --json media create-cinematic --prompt "<PROMPT>" --aspect-ratio "<RATIO>" -o media/<NAME>.mp4
```

Options: `--duration <4-8>`, `--resolution <720p|1080p>`, `--enhance-prompt`, `--generate-audio`, `--negative-prompt`, `--sample-count <1-4>`, `--first-frame <file>`, `--last-frame <file>`, `--reference-images <files>`.

## Typical Workflow (Image Editing)

Edit an existing image with a prompt — single command:

```bash
gobi --json media edit-image --image media/source.png --prompt "<EDIT_INSTRUCTION>" -o media/<NAME>.png
```

All file arguments (`--image`, `--mask`, `--background`, `--photo`, `--audio`, `--reference-image`, `--first-frame`, `--last-frame`) accept local file paths and auto-upload them. No need to manually upload first.

## Custom Avatars

Three ways to create custom avatars:

### 1. Design from scratch

```bash
gobi --json media design-avatar --gender "<GENDER>" --age "<AGE>" --ethnicity "<ETHNICITY>" --outfit "<OUTFIT>" --background "<BACKGROUND>" --wait
```

When `variants_ready`, confirm with:

```bash
gobi --json media confirm-avatar --job-id "<JOB_ID>"
```

### 2. From a selfie (instant)

```bash
gobi --json media design-avatar-from-selfie --photo media/selfie.png
```

### 3. From a selfie (enhanced with prompt)

```bash
gobi --json media design-avatar-from-selfie --photo media/selfie.png --prompt "<ENHANCEMENT>" --wait
```

Check any avatar job status with:

```bash
gobi --json media get-avatar-job-status <jobId> --wait
```

**IMPORTANT: After downloading, show the video using Obsidian wiki-link syntax EXACTLY like this:**

```
![[media/<NAME>.mp4]]
```

Do NOT use markdown image/link syntax `![](...)` or `gobi://` URLs in chat. For posts/replies use `--attach media/<NAME>.mp4` instead — see the image workflow above for details.

## Available Commands

### Upload

- `gobi media upload <file>` — Upload a local file and return its media ID. Content type is auto-detected.

### Avatars & Voices

- `gobi media list-avatars` — List available avatars.
- `gobi media list-voices` — List available voices.

### Videos

- `gobi media create-video` — Create an avatar video generation job.
- `gobi media create-cinematic` — Create a cinematic video from a text prompt.
- `gobi media list-videos` — List all videos.
- `gobi media get-video` — Get video metadata.
- `gobi media get-video-status` — Get video generation status.
- `gobi media download-video` — Download a completed video (`-o` to save to file).

### Custom Avatars

- `gobi media design-avatar` — Start a design-your-avatar job.
- `gobi media confirm-avatar` — Confirm avatar variant(s) after design.
- `gobi media design-avatar-from-selfie` — Design an avatar from a selfie (instant or enhanced).
- `gobi media get-avatar-job-status` — Get avatar job status.

### Images

- `gobi media generate-image` — Generate an image from a text prompt. Types: image (default), thumbnail (YouTube-optimized), asset (logo/product). Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4
- `gobi media edit-image` — Edit an existing image with a prompt (image-to-image).
- `gobi media inpaint-image` — Inpaint an image region using a mask.
- `gobi media get-image-status` — Get image generation job status.
- `gobi media download-image` — Download a generated image.

## Confirm before mutating

Media generation jobs consume credits (real-world billable cost) and produce assets attached to the user's account. Videos and avatar work can take minutes per job. Before running any generation/upload command, confirm with the user — show the exact command and the prompt / script / source files / aspect ratio / duration. This applies even when running autonomously.

- `generate-image`, `edit-image`, `inpaint-image` — quick but billable per job.
- `create-video`, `create-cinematic` — slower and more expensive; confirm script, avatar/voice ids, and aspect ratio before submitting.
- `design-avatar`, `confirm-avatar`, `design-avatar-from-selfie` — produce assets the user will see in their avatar list. Confirm the photo/prompt and that the user wants the variant locked in (`confirm-avatar` is the commit step).
- `upload` — adds to the user's media. Low-stakes but still a write; mention the file before uploading.

Read-only commands (`list-avatars`, `list-voices`, `get-image-status`, `get-video-status`, `list-videos`, `get-video`, `get-avatar-job-status`) and downloads (`download-image`, `download-video`) run without confirmation.

## Reference Documentation

- [gobi media](references/media.md)

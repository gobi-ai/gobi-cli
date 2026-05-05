# gobi media

```
Usage: gobi media [options] [command]

Media generation commands (videos, images).

Options:
  -h, --help                               display help for command

Commands:
  upload <file>                            Upload a local file and return its media ID.
  list-avatars                             List available avatars.
  list-voices                              List available voices.
  create-video [options]                   Create an avatar video generation job.
  list-videos                              List all videos.
  get-video <videoId>                      Get video metadata.
  get-video-status [options] <videoId>     Get video generation status.
  download-video [options] <videoId>       Download a completed video (or get its URL).
  create-cinematic [options]               Create a cinematic video from a text prompt.
  design-avatar [options]                  Start a design-your-avatar job.
  confirm-avatar [options]                 Confirm avatar variant(s) after design.
  design-avatar-from-selfie [options]      Design an avatar from a selfie (instant or enhanced with prompt).
  get-avatar-job-status [options] <jobId>  Get avatar job status.
  generate-image [options]                 Generate an image from a text prompt. Types: image (default), thumbnail (YouTube-optimized), asset (logo/product). Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4
  edit-image [options]                     Edit an existing image with a prompt (image-to-image).
  inpaint-image [options]                  Inpaint an image region using a mask.
  get-image-status [options] <jobId>       Get image generation job status.
  download-image [options] <jobId>         Download a generated image.
  help [command]                           display help for command
```

## upload

```
Usage: gobi media upload [options] <file>

Upload a local file and return its media ID.

Options:
  -h, --help  display help for command
```

## list-avatars

```
Usage: gobi media list-avatars [options]

List available avatars.

Options:
  -h, --help  display help for command
```

## list-voices

```
Usage: gobi media list-voices [options]

List available voices.

Options:
  -h, --help  display help for command
```

## create-video

```
Usage: gobi media create-video [options]

Create an avatar video generation job.

Options:
  --name <name>           Name for the video (auto-generated if omitted)
  --avatar-id <avatarId>  Avatar to use
  --voice-id <voiceId>    Voice to use
  --script <script>       Script for the avatar to read
  --background <file>     Background image file (auto-uploaded)
  --wait                  Poll until generation completes
  -o, --output <path>     Download video to this path when done (implies --wait)
  -h, --help              display help for command
```

## list-videos

```
Usage: gobi media list-videos [options]

List all videos.

Options:
  -h, --help  display help for command
```

## get-video

```
Usage: gobi media get-video [options] <videoId>

Get video metadata.

Options:
  -h, --help  display help for command
```

## get-video-status

```
Usage: gobi media get-video-status [options] <videoId>

Get video generation status.

Options:
  --wait               Poll until a terminal state is reached
  -o, --output <path>  Download video to this path when complete (implies --wait)
  -h, --help           display help for command
```

## download-video

```
Usage: gobi media download-video [options] <videoId>

Download a completed video (or get its URL).

Options:
  -o, --output <path>  Save video to this file path
  -h, --help           display help for command
```

## create-cinematic

```
Usage: gobi media create-cinematic [options]

Create a cinematic video from a text prompt.

Options:
  --prompt <prompt>                   Text prompt describing the video
  --name <name>                       Name for the video (auto-generated if omitted)
  --aspect-ratio <aspectRatio>        Aspect ratio: 16:9, 9:16, 1:1
  --duration <seconds>                Duration in seconds (4-8)
  --resolution <resolution>           Resolution: 720p, 1080p
  --enhance-prompt                    Enhance the prompt with AI
  --generate-audio                    Generate audio for the video
  --negative-prompt <negativePrompt>  Negative prompt
  --sample-count <count>              Number of samples (1-4)
  --first-frame <file>                First frame image file (auto-uploaded)
  --last-frame <file>                 Last frame image file (auto-uploaded)
  --reference-images <files>          Comma-separated reference image files (auto-uploaded, max 3)
  --wait                              Poll until generation completes
  -o, --output <path>                 Download video to this path when done (implies --wait)
  -h, --help                          display help for command
```

## design-avatar

```
Usage: gobi media design-avatar [options]

Start a design-your-avatar job.

Options:
  --name <name>              Name for the avatar (auto-generated if omitted)
  --gender <gender>          Gender for the avatar design
  --age <age>                Age range for the avatar
  --ethnicity <ethnicity>    Ethnicity for the avatar
  --outfit <outfit>          Outfit description
  --background <background>  Background description
  --no-portrait              Generate full-body instead of portrait
  --audio <file>             Custom voice audio file (auto-uploaded)
  --wait                     Poll until variants are ready
  -h, --help                 display help for command
```

## confirm-avatar

```
Usage: gobi media confirm-avatar [options]

Confirm avatar variant(s) after design.

Options:
  --job-id <jobId>     Job ID from design-avatar
  --variant <variant>  Variant to confirm (1 or 2); omit to confirm both
  -h, --help           display help for command
```

## design-avatar-from-selfie

```
Usage: gobi media design-avatar-from-selfie [options]

Design an avatar from a selfie (instant or enhanced with prompt).

Options:
  --name <name>      Name for the avatar (auto-generated if omitted)
  --photo <file>     Selfie photo file (auto-uploaded)
  --prompt <prompt>  Enhancement prompt (triggers async enhance flow)
  --audio <file>     Custom voice audio file (auto-uploaded)
  --wait             Poll until job completes (only for enhance flow)
  -h, --help         display help for command
```

## get-avatar-job-status

```
Usage: gobi media get-avatar-job-status [options] <jobId>

Get avatar job status.

Options:
  --wait      Poll until a terminal state is reached
  -h, --help  display help for command
```

## generate-image

```
Usage: gobi media generate-image [options]

Generate an image from a text prompt. Types: image (default), thumbnail (YouTube-optimized), asset (logo/product). Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4

Options:
  --prompt <prompt>                   Text prompt for image generation
  --name <name>                       Name for the generated image (auto-generated from prompt if omitted)
  --type <type>                       Generation type: image (default), thumbnail (YouTube-optimized), asset (logo/product)
  --aspect-ratio <aspectRatio>        Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)
  --negative-prompt <negativePrompt>  Negative prompt
  --seed <seed>                       Random seed for reproducibility
  --reference-image <file>            Reference image file (auto-uploaded)
  --wait                              Poll until generation completes
  -o, --output <path>                 Download image to this path when done (implies --wait)
  -h, --help                          display help for command
```

## edit-image

```
Usage: gobi media edit-image [options]

Edit an existing image with a prompt (image-to-image).

Options:
  --image <file>       Source image file (auto-uploaded)
  --prompt <prompt>    Edit instruction
  --name <name>        Name for the edited image (auto-generated if omitted)
  --wait               Poll until generation completes
  -o, --output <path>  Download image to this path when done (implies --wait)
  -h, --help           display help for command
```

## inpaint-image

```
Usage: gobi media inpaint-image [options]

Inpaint an image region using a mask.

Options:
  --image <file>       Source image file (auto-uploaded)
  --mask <file>        Mask image file (auto-uploaded)
  --prompt <prompt>    Inpainting prompt
  --name <name>        Name for the inpainted image (auto-generated if omitted)
  --wait               Poll until generation completes
  -o, --output <path>  Download image to this path when done (implies --wait)
  -h, --help           display help for command
```

## get-image-status

```
Usage: gobi media get-image-status [options] <jobId>

Get image generation job status.

Options:
  --wait      Poll until a terminal state is reached
  -h, --help  display help for command
```

## download-image

```
Usage: gobi media download-image [options] <jobId>

Download a generated image.

Options:
  --wait               Poll until generation completes before downloading
  --type <type>        Image type (image, thumbnail, asset)
  -o, --output <path>  Output file path (default: {jobId}.{ext} in current directory)
  -h, --help           display help for command
```

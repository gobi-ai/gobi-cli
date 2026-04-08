# gobi media

```
Usage: gobi media [options] [command]

Media generation commands (videos, images).

Options:
  -h, --help                           display help for command

Commands:
  upload [options] <file>              Upload a local file and return its media ID.
  avatars                              List available avatars.
  voices                               List available voices.
  video-create [options]               Create an avatar video generation job.
  video-list                           List all videos.
  video-get <id>                       Get video metadata.
  video-status [options] <id>          Poll video generation status.
  video-download [options] <id>        Download a completed video (or get its URL).
  cinematic-create [options]           Create a cinematic video from a text prompt.
  avatar-design [options]              Start a design-your-avatar job.
  avatar-confirm [options]             Confirm avatar variant(s) after design.
  avatar-from-selfie [options]         Create an avatar from a selfie (instant or enhanced with prompt).
  avatar-job-status [options] <jobId>  Check avatar job status.
  image-generate [options]             Generate an image from a text prompt. Types: image (default), thumbnail (YouTube-optimized), asset (logo/product). Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4
  image-edit [options]                 Edit an existing image with a prompt (image-to-image).
  image-inpaint [options]              Inpaint an image region using a mask.
  image-status [options] <jobId>       Check image generation job status.
  image-download [options] <jobId>     Download a generated image.
  help [command]                       display help for command
```

## upload

```
Usage: gobi media upload [options] <file>

Upload a local file and return its media ID.

Options:
  --content-type <contentType>  MIME type override (auto-detected from extension if omitted)
  -h, --help                    display help for command
```

## avatars

```
Usage: gobi media avatars [options]

List available avatars.

Options:
  -h, --help  display help for command
```

## voices

```
Usage: gobi media voices [options]

List available voices.

Options:
  -h, --help  display help for command
```

## video-create

```
Usage: gobi media video-create [options]

Create an avatar video generation job.

Options:
  --name <name>                              Name for the video (auto-generated if omitted)
  --avatar-id <avatarId>                     Avatar to use
  --voice-id <voiceId>                       Voice to use
  --script <script>                          Script for the avatar to read
  --background-media-id <backgroundMediaId>  Background media ID (from upload)
  --wait                                     Poll until generation completes
  -o, --output <path>                        Download video to this path when done (implies --wait)
  -h, --help                                 display help for command
```

## video-list

```
Usage: gobi media video-list [options]

List all videos.

Options:
  -h, --help  display help for command
```

## video-get

```
Usage: gobi media video-get [options] <id>

Get video metadata.

Options:
  -h, --help  display help for command
```

## video-status

```
Usage: gobi media video-status [options] <id>

Poll video generation status.

Options:
  --wait               Poll until a terminal state is reached
  -o, --output <path>  Download video to this path when complete (implies --wait)
  -h, --help           display help for command
```

## video-download

```
Usage: gobi media video-download [options] <id>

Download a completed video (or get its URL).

Options:
  -o, --output <path>  Save video to this file path
  -h, --help           display help for command
```

## cinematic-create

```
Usage: gobi media cinematic-create [options]

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
  --first-frame-media-id <mediaId>    First frame image media ID
  --last-frame-media-id <mediaId>     Last frame image media ID
  --reference-media-ids <ids>         Comma-separated reference image media IDs (max 3)
  --wait                              Poll until generation completes
  -o, --output <path>                 Download video to this path when done (implies --wait)
  -h, --help                          display help for command
```

## avatar-design

```
Usage: gobi media avatar-design [options]

Start a design-your-avatar job.

Options:
  --name <name>               Name for the avatar (auto-generated if omitted)
  --gender <gender>           Gender for the avatar design
  --age <age>                 Age range for the avatar
  --ethnicity <ethnicity>     Ethnicity for the avatar
  --outfit <outfit>           Outfit description
  --background <background>   Background description
  --no-portrait               Generate full-body instead of portrait
  --audio-media-id <mediaId>  Custom voice audio media ID
  --wait                      Poll until variants are ready
  -h, --help                  display help for command
```

## avatar-confirm

```
Usage: gobi media avatar-confirm [options]

Confirm avatar variant(s) after design.

Options:
  --job-id <jobId>     Job ID from avatar-design
  --variant <variant>  Variant to confirm (1 or 2); omit to confirm both
  -h, --help           display help for command
```

## avatar-from-selfie

```
Usage: gobi media avatar-from-selfie [options]

Create an avatar from a selfie (instant or enhanced with prompt).

Options:
  --name <name>               Name for the avatar (auto-generated if omitted)
  --photo-media-id <mediaId>  Selfie photo media ID
  --prompt <prompt>           Enhancement prompt (triggers async enhance flow)
  --audio-media-id <mediaId>  Custom voice audio media ID
  --wait                      Poll until job completes (only for enhance flow)
  -h, --help                  display help for command
```

## avatar-job-status

```
Usage: gobi media avatar-job-status [options] <jobId>

Check avatar job status.

Options:
  --wait      Poll until a terminal state is reached
  -h, --help  display help for command
```

## image-generate

```
Usage: gobi media image-generate [options]

Generate an image from a text prompt. Types: image (default), thumbnail (YouTube-optimized), asset (logo/product). Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4

Options:
  --prompt <prompt>                        Text prompt for image generation
  --name <name>                            Name for the generated image (auto-generated from prompt if omitted)
  --type <type>                            Generation type: image (default), thumbnail (YouTube-optimized), asset (logo/product)
  --aspect-ratio <aspectRatio>             Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)
  --negative-prompt <negativePrompt>       Negative prompt
  --seed <seed>                            Random seed for reproducibility
  --reference-media-id <referenceMediaId>  Reference image media ID
  --wait                                   Poll until generation completes
  -o, --output <path>                      Download image to this path when done (implies --wait)
  -h, --help                               display help for command
```

## image-edit

```
Usage: gobi media image-edit [options]

Edit an existing image with a prompt (image-to-image).

Options:
  --media-id <mediaId>  Source image media ID
  --prompt <prompt>     Edit instruction
  --name <name>         Name for the edited image (auto-generated if omitted)
  --wait                Poll until generation completes
  -o, --output <path>   Download image to this path when done (implies --wait)
  -h, --help            display help for command
```

## image-inpaint

```
Usage: gobi media image-inpaint [options]

Inpaint an image region using a mask.

Options:
  --media-id <mediaId>           Source image media ID
  --mask-media-id <maskMediaId>  Mask image media ID
  --prompt <prompt>              Inpainting prompt
  --name <name>                  Name for the inpainted image (auto-generated if omitted)
  --wait                         Poll until generation completes
  -o, --output <path>            Download image to this path when done (implies --wait)
  -h, --help                     display help for command
```

## image-status

```
Usage: gobi media image-status [options] <jobId>

Check image generation job status.

Options:
  --wait      Poll until a terminal state is reached
  -h, --help  display help for command
```

## image-download

```
Usage: gobi media image-download [options] <jobId>

Download a generated image.

Options:
  --wait               Poll until generation completes before downloading
  --type <type>        Image type (image, thumbnail, asset)
  -o, --output <path>  Output file path (default: {jobId}.{ext} in current directory)
  -h, --help           display help for command
```

# gobi media

```
Usage: gobi media [options] [command]

Media generation commands (videos, images).

Options:
  -h, --help                      display help for command

Commands:
  upload-init [options]           Get a presigned upload URL for a media file.
  upload-finalize [options]       Confirm that a media upload is complete.
  avatars                         List available avatars.
  voices                          List available voices.
  video-create [options]          Create an avatar video generation job.
  video-list                      List all videos.
  video-get <id>                  Get video metadata.
  video-status [options] <id>     Poll video generation status.
  video-download <id>             Get the download URL for a completed video.
  image-generate [options]        Generate an image from a text prompt. Types: image (default), thumbnail (YouTube-optimized), asset (logo/product). Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4
  image-edit [options]            Edit an existing image with a prompt (image-to-image).
  image-inpaint [options]         Inpaint an image region using a mask.
  image-status [options] <jobId>  Check image generation job status.
  help [command]                  display help for command
```

## upload-init

```
Usage: gobi media upload-init [options]

Get a presigned upload URL for a media file.

Options:
  --file-name <fileName>        Name of the file to upload
  --content-type <contentType>  MIME type (e.g. image/png, video/mp4)
  --file-size <fileSize>        File size in bytes
  -h, --help                    display help for command
```

## upload-finalize

```
Usage: gobi media upload-finalize [options]

Confirm that a media upload is complete.

Options:
  --media-id <mediaId>  Media ID from upload-init
  -h, --help            display help for command
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
  --name <name>                              Name for the video
  --avatar-id <avatarId>                     Avatar to use
  --voice-id <voiceId>                       Voice to use
  --script <script>                          Script for the avatar to read
  --background-media-id <backgroundMediaId>  Background media ID (from upload)
  --wait                                     Poll until generation completes
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
  --wait      Poll until a terminal state is reached
  -h, --help  display help for command
```

## video-download

```
Usage: gobi media video-download [options] <id>

Get the download URL for a completed video.

Options:
  -h, --help  display help for command
```

## image-generate

```
Usage: gobi media image-generate [options]

Generate an image from a text prompt. Types: image (default), thumbnail (YouTube-optimized), asset (logo/product). Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4

Options:
  --prompt <prompt>                        Text prompt for image generation
  --name <name>                            Name for the generated image
  --type <type>                            Generation type: image (default), thumbnail (YouTube-optimized), asset (logo/product)
  --aspect-ratio <aspectRatio>             Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)
  --negative-prompt <negativePrompt>       Negative prompt
  --seed <seed>                            Random seed for reproducibility
  --reference-media-id <referenceMediaId>  Reference image media ID
  --wait                                   Poll until generation completes
  -h, --help                               display help for command
```

## image-edit

```
Usage: gobi media image-edit [options]

Edit an existing image with a prompt (image-to-image).

Options:
  --media-id <mediaId>  Source image media ID
  --prompt <prompt>     Edit instruction
  --name <name>         Name for the edited image
  --wait                Poll until generation completes
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
  --name <name>                  Name for the inpainted image
  --wait                         Poll until generation completes
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

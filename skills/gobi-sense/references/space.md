# gobi space

```
Usage: gobi space [options] [command]

Space commands (posts, replies). Space and member admin is web-UI only.

Options:
  --space-slug <spaceSlug>                    Space slug (overrides .gobi/settings.yaml)
  -h, --help                                  display help for command

Commands:
  conversations                               The space's conversations — every member's, attributed to each recorder (Audio Logs started in this space + detected conversations). Transcript and audio
                                              stay owner-only. Activities and artifacts are personal-only (see `gobi personal`).
  help [command]                              display help for command
```

## conversations

```
Usage: gobi space conversations [options] [command]

The space's conversations — every member's, attributed to each recorder (Audio Logs started in this space + detected conversations). Transcript and audio stay owner-only. Activities and artifacts are
personal-only (see `gobi personal`).

Options:
  -h, --help            display help for command

Commands:
  list [options]        List conversations captured in this scope (newest first).
  get <conversationId>  Get a conversation's summary, side notes, linked note, and transcript (owner-only). <conversationId> is an opaque public id (o…).
  help [command]        display help for command
```

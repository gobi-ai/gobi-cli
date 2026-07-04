# gobi space

```
Usage: gobi space [options] [command]

Space commands (posts, replies). Space and member admin is web-UI only.

Options:
  --space-slug <spaceSlug>                    Space slug (overrides .gobi/settings.yaml)
  -h, --help                                  display help for command

Commands:
  activities                                  This space's Sense activities — every member's, attributed to each recorder (browse-only). Use `gobi space --space-slug <slug> activities …` or set the
                                              active space with `gobi space warp`.
  conversations                               This space's Sense conversations — every member's, attributed to each recorder (browse-only; transcript/audio stay owner-only). Use `gobi space
                                              --space-slug <slug> conversations …` or set the active space with `gobi space warp`.
  help [command]                              display help for command
```

## activities

```
Usage: gobi space activities [options] [command]

This space's Sense activities — every member's, attributed to each recorder (browse-only). Use `gobi space --space-slug <slug> activities …` or set the active space with `gobi space warp`.

Options:
  -h, --help               display help for command

Commands:
  list [options]           List Sense activities in this scope (newest first).
  get <activityId>         Get one activity's details (visible to you if you recorded it or are a member of its space).
  transcript <activityId>  Get an activity's transcript (owner-only; 403 for other space members).
  help [command]           display help for command
```

## conversations

```
Usage: gobi space conversations [options] [command]

This space's Sense conversations — every member's, attributed to each recorder (browse-only; transcript/audio stay owner-only). Use `gobi space --space-slug <slug> conversations …` or set the active
space with `gobi space warp`.

Options:
  -h, --help                   display help for command

Commands:
  list [options]               List conversations captured in this scope (newest first).
  transcript <conversationId>  Get a conversation's transcript and summary (owner-only).
  audio <conversationId>       Get a signed URL for a conversation's combined recording (owner-only; null for analyzer conversations).
  help [command]               display help for command
```

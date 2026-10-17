# gobi space

```
Usage: gobi space [options] [command]

Space commands (posts, replies). Space and member admin is web-UI only.

Options:
  --space-slug <spaceSlug>   Space slug (overrides .gobi/settings.yaml)
  -h, --help                 display help for command

Commands:
  notes                      The space's notes — every member's, attributed to each recorder. A note is a record of one captured moment, made from an audio log, a video log, a meeting, an imported
                             recording, a conversation Sense detected, or text a member wrote; each has a title, a summary and, when there was speech, a transcript. Notes and activities are records
                             that belong to this space and are never shared directly: to share one outside the space, make it an artifact.
  activities                 The space's activities — what members were doing over a stretch of time (traveling, working, talking…), detected by Sense while capturing into this space. Like notes,
                             they are records that belong to the space and are never shared directly. Each row is complete; there is no per-activity `get` here.
  help [command]             display help for command
```

## notes

```
Usage: gobi space notes [options] [command]

The space's notes — every member's, attributed to each recorder. A note is a record of one captured moment, made from an audio log, a video log, a meeting, an imported recording, a conversation Sense
detected, or text a member wrote; each has a title, a summary and, when there was speech, a transcript. Notes and activities are records that belong to this space and are never shared directly: to
share one outside the space, make it an artifact.

Options:
  -h, --help      display help for command

Commands:
  list [options]  List the space's notes, newest first — every audio log, video log, meeting, imported recording, Sense-detected conversation and written note. People only: an agent opens a note by
                  its id.
  get <noteId>    Get a note: what it was made from, its summary, side notes, transcript, and the artifact it was shared as (if any). Readable by the recorder or a member of the note's space (an
                  agent reads as the person it acts for). <noteId> is an opaque public id (o…).
  help [command]  display help for command
```

## notes list

```
Usage: gobi space notes list [options]

List the space's notes, newest first — every audio log, video log, meeting, imported recording, Sense-detected conversation and written note. People only: an agent opens a note by its id.

Options:
  --limit <n>               Max items to return (default 30, max 100)
  --before <cursor>         Pagination cursor from a previous response (nextCursor)
  --mine                    Only notes you recorded. Filters a space's list; every personal note is already yours
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## notes get

```
Usage: gobi space notes get [options] <noteId>

Get a note: what it was made from, its summary, side notes, transcript, and the artifact it was shared as (if any). Readable by the recorder or a member of the note's space (an agent reads as the
person it acts for). <noteId> is an opaque public id (o…).

Options:
  -h, --help  display help for command
```

## activities

```
Usage: gobi space activities [options] [command]

The space's activities — what members were doing over a stretch of time (traveling, working, talking…), detected by Sense while capturing into this space. Like notes, they are records that belong to
the space and are never shared directly. Each row is complete; there is no per-activity `get` here.

Options:
  -h, --help      display help for command

Commands:
  list [options]  List the space's activities (newest first).
  help [command]  display help for command
```

## activities list

```
Usage: gobi space activities list [options]

List the space's activities (newest first).

Options:
  --limit <n>               Max items to return (default 30, max 100)
  --before <cursor>         Pagination cursor from a previous response (nextCursor)
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

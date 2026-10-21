# gobi personal

```
Usage: gobi personal [options] [command]

Personal-space commands (private posts, replies, and DMs with your personal bots). Posts/replies live in the same data model as space posts, scoped via personalSpaceUserId so they never surface on
the public feed.

Options:
  -h, --help         display help for command

Commands:
  context [options]  Compact snapshot of recent real-world context for assistant agents: the current/latest activity, recent activities, recent notes (id, title, time, summary, speakers), and fresh
                     captures (notes/activities created in the window). Read-only. Composes `personal notes list/get` and `personal activities list/get` — no new backend endpoint.
  activities         Your personal space's activities: what you were doing over a stretch of time (traveling, working, talking…), detected by Sense. Like notes, they are records that belong to their
                     lane — your personal space here, a space under `gobi space activities` — and are never shared directly.
  notes              Your personal space's notes. A note is a record of one captured moment, made from an audio log (phone, watch or desktop), a video log, a meeting, an imported recording, a
                     conversation Sense detected, or text you wrote; each has a title, a summary and, when there was speech, a transcript. Notes and activities are records that belong to their lane —
                     your personal space here, a space under `gobi space notes` — and are never shared directly: to share one outside its lane, make it an artifact.
  help [command]     display help for command
```

## context

```
Usage: gobi personal context [options]

Compact snapshot of recent real-world context for assistant agents: the current/latest activity, recent activities, recent notes (id, title, time, summary, speakers), and fresh captures
(notes/activities created in the window). Read-only. Composes `personal notes list/get` and `personal activities list/get` — no new backend endpoint.

Options:
  --since <when>  Window start: duration (24h, 7d, 30m) or ISO timestamp (default: 24h) (default: "24h")
  --limit <n>     Max items per section (default 5, max 50) (default: "5")
  -h, --help      display help for command
```

## activities

```
Usage: gobi personal activities [options] [command]

Your personal space's activities: what you were doing over a stretch of time (traveling, working, talking…), detected by Sense. Like notes, they are records that belong to their lane — your personal
space here, a space under `gobi space activities` — and are never shared directly.

Options:
  -h, --help        display help for command

Commands:
  list [options]    List the personal space's activities (newest first).
  get <activityId>  Get one activity's details (visible if you recorded it).
  help [command]    display help for command
```

## activities list

```
Usage: gobi personal activities list [options]

List the personal space's activities (newest first).

Options:
  --limit <n>        Max items to return (default 30, max 100)
  --before <cursor>  Pagination cursor from a previous response (nextCursor)
  -h, --help         display help for command
```

## activities get

```
Usage: gobi personal activities get [options] <activityId>

Get one activity's details (visible if you recorded it).

Options:
  -h, --help  display help for command
```

## notes

```
Usage: gobi personal notes [options] [command]

Your personal space's notes. A note is a record of one captured moment, made from an audio log (phone, watch or desktop), a video log, a meeting, an imported recording, a conversation Sense detected,
or text you wrote; each has a title, a summary and, when there was speech, a transcript. Notes and activities are records that belong to their lane — your personal space here, a space under `gobi
space notes` — and are never shared directly: to share one outside its lane, make it an artifact.

Options:
  -h, --help      display help for command

Commands:
  list [options]  List the personal space's notes, newest first — every audio log, video log, meeting, imported recording, Sense-detected conversation and written note. People only: an agent opens a
                  note by its id.
  get <noteId>    Get a note: what it was made from, its summary, side notes, transcript, and the artifact it was shared as (if any). Readable by the recorder or a member of the note's space (an
                  agent reads as the person it acts for). <noteId> is an opaque public id (o…).
  help [command]  display help for command
```

## notes list

```
Usage: gobi personal notes list [options]

List the personal space's notes, newest first — every audio log, video log, meeting, imported recording, Sense-detected conversation and written note. People only: an agent opens a note by its id.

Options:
  --limit <n>        Max items to return (default 30, max 100)
  --before <cursor>  Pagination cursor from a previous response (nextCursor)
  --mine             Only notes you recorded. Filters a space's list; every personal note is already yours
  -h, --help         display help for command
```

## notes get

```
Usage: gobi personal notes get [options] <noteId>

Get a note: what it was made from, its summary, side notes, transcript, and the artifact it was shared as (if any). Readable by the recorder or a member of the note's space (an agent reads as the
person it acts for). <noteId> is an opaque public id (o…).

Options:
  -h, --help  display help for command
```

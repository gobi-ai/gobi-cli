# gobi notes

```
Usage: gobi notes [options] [command]

Personal notes (create, list, get, edit, delete).

Options:
  -h, --help               display help for command

Commands:
  list [options]           List your notes. Without --date, returns recent notes via cursor pagination. With --date, returns all notes for that day.
  get <noteId>             Get a single note by id.
  create [options]         Create a note. Provide --content (use '-' for stdin) and/or attachments.
  edit [options] <noteId>  Edit a note. Provide --content and/or --agent-id.
  delete <noteId>          Delete a note you authored.
  help [command]           display help for command
```

## list

```
Usage: gobi notes list [options]

List your notes. Without --date, returns recent notes via cursor pagination. With --date, returns all notes for that day.

Options:
  --date <date>      Filter to a single day (YYYY-MM-DD)
  --timezone <tz>    IANA timezone name (default: system timezone)
  --limit <number>   Items per page (1-100) (default: "50")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## get

```
Usage: gobi notes get [options] <noteId>

Get a single note by id.

Options:
  -h, --help  display help for command
```

## create

```
Usage: gobi notes create [options]

Create a note. Provide --content (use '-' for stdin) and/or attachments.

Options:
  --content <content>  Note content (markdown supported, use "-" for stdin)
  --timezone <tz>      IANA timezone name (default: system timezone)
  --agent-id <number>  Optional agent id to associate with the note
  -h, --help           display help for command
```

## edit

```
Usage: gobi notes edit [options] <noteId>

Edit a note. Provide --content and/or --agent-id.

Options:
  --content <content>  New note content (markdown supported, use "-" for stdin)
  --agent-id <number>  New agent id, or "null" to clear the association
  -h, --help           display help for command
```

## delete

```
Usage: gobi notes delete [options] <noteId>

Delete a note you authored.

Options:
  -h, --help  display help for command
```

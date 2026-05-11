# gobi saved

```
Usage: gobi saved [options] [command]

Saved-knowledge commands (notes and bookmarked posts).

Options:
  -h, --help                    display help for command

Commands:
  list-notes [options]          List your notes. Without --date, returns recent notes via cursor pagination. With --date, returns all notes for that day.
  get-note <noteId>             Get a single note by id.
  create-note [options]         Create a note. Provide --content (use '-' for stdin), or --draft-id to source content from a draft.
  edit-note [options] <noteId>  Edit a note. Provide --content and/or --agent-id.
  delete-note <noteId>          Delete a note you authored.
  list-posts [options]          List posts you have bookmarked (paginated).
  get-post <postId>             Get a saved post snapshot by post id.
  create-post [options]         Bookmark a post or reply by id. Records a snapshot in your saved-posts collection.
  delete-post <postId>          Remove a post from your saved-posts collection.
  help [command]                display help for command
```

## list-notes

```
Usage: gobi saved list-notes [options]

List your notes. Without --date, returns recent notes via cursor pagination. With --date, returns all notes for that day.

Options:
  --date <date>      Filter to a single day (YYYY-MM-DD)
  --timezone <tz>    IANA timezone name (default: system timezone)
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## get-note

```
Usage: gobi saved get-note [options] <noteId>

Get a single note by id.

Options:
  -h, --help  display help for command
```

## create-note

```
Usage: gobi saved create-note [options]

Create a note. Provide --content (use '-' for stdin), or --draft-id to source content from a draft.

Options:
  --content <content>   Note content (markdown supported, use "-" for stdin)
  --timezone <tz>       IANA timezone name (default: system timezone)
  --agent-id <number>   Optional agent id to associate with the note
  --draft-id <draftId>  Use this draft as the source of content (mutually exclusive with --content). The draft's title is prepended as an H1 heading. On success, links the note back by recording
                        noteId on draft.metadata so the client can render an 'Open note' button.
  -h, --help            display help for command
```

## edit-note

```
Usage: gobi saved edit-note [options] <noteId>

Edit a note. Provide --content and/or --agent-id.

Options:
  --content <content>  New note content (markdown supported, use "-" for stdin)
  --agent-id <number>  New agent id, or "null" to clear the association
  -h, --help           display help for command
```

## delete-note

```
Usage: gobi saved delete-note [options] <noteId>

Delete a note you authored.

Options:
  -h, --help  display help for command
```

## list-posts

```
Usage: gobi saved list-posts [options]

List posts you have bookmarked (paginated).

Options:
  --type <type>      Filter by type: all|article|space-post (default: "all")
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## get-post

```
Usage: gobi saved get-post [options] <postId>

Get a saved post snapshot by post id.

Options:
  -h, --help  display help for command
```

## create-post

```
Usage: gobi saved create-post [options]

Bookmark a post or reply by id. Records a snapshot in your saved-posts collection.

Options:
  --source <id>  Source post or reply id to bookmark (numeric)
  -h, --help     display help for command
```

## delete-post

```
Usage: gobi saved delete-post [options] <postId>

Remove a post from your saved-posts collection.

Options:
  -h, --help  display help for command
```

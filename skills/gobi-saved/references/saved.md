# gobi saved

```
Usage: gobi saved [options] [command]

Saved-knowledge commands (notes and posts).

Options:
  -h, --help      display help for command

Commands:
  note            Personal saved notes (create, list, get, edit, delete).
  post            Saved posts (snapshots of posts and replies you bookmark).
  help [command]  display help for command
```

## note

```
Usage: gobi saved note [options] [command]

Personal saved notes (create, list, get, edit, delete).

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

## post

```
Usage: gobi saved post [options] [command]

Saved posts (snapshots of posts and replies you bookmark).

Options:
  -h, --help        display help for command

Commands:
  list [options]    List posts you have saved.
  get <postId>      Get a saved post snapshot by post id.
  create [options]  Save a post or reply. Records a snapshot in your saved-posts collection.
  delete <postId>   Remove a post from your saved-posts collection.
  help [command]    display help for command
```

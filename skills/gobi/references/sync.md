# gobi sync

```
Usage: gobi sync [options]

Sync local vault files with Gobi Webdrive.

Options:
  --upload-only          Only upload local changes to server
  --download-only        Only download server changes to local
  --conflict <strategy>  Conflict resolution strategy: ask|server|client|skip (default: "ask")
  --dir <path>           Local vault directory (default: current directory)
  --dry-run              Preview changes without making them
  --full                 Full sync: ignore cursor and hash cache, re-check every file
  --path <path>          Restrict sync to a specific file or folder (repeatable) (default: [])
  -h, --help             display help for command
```

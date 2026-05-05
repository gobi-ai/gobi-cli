# gobi vault

```
Usage: gobi vault [options] [command]

Vault commands (init, list, publish/unpublish profile, sync files).

Options:
  -h, --help      display help for command

Commands:
  init            Select or create the vault for the current directory. Writes .gobi/settings.yaml and seeds PUBLISH.md.
  list            List vaults you own.
  publish         Upload PUBLISH.md to the vault root on webdrive. Triggers post-processing (vault sync, metadata update, Discord notification).
  unpublish       Delete PUBLISH.md from the vault on webdrive.
  sync [options]  Sync local vault files with Gobi Webdrive.
  help [command]  display help for command
```

## init

```
Usage: gobi vault init [options]

Select or create the vault for the current directory. Writes .gobi/settings.yaml and seeds PUBLISH.md.

Options:
  -h, --help  display help for command
```

## list

```
Usage: gobi vault list [options]

List vaults you own.

Options:
  -h, --help  display help for command
```

## publish

```
Usage: gobi vault publish [options]

Upload PUBLISH.md to the vault root on webdrive. Triggers post-processing (vault sync, metadata update, Discord notification).

Options:
  -h, --help  display help for command
```

## unpublish

```
Usage: gobi vault unpublish [options]

Delete PUBLISH.md from the vault on webdrive.

Options:
  -h, --help  display help for command
```

## sync

```
Usage: gobi vault sync [options]

Sync local vault files with Gobi Webdrive.

Options:
  --upload-only              Only upload local changes to server
  --download-only            Only download server changes to local
  --conflict <strategy>      Conflict resolution strategy: ask|server|client|skip (default: "ask")
  --dir <path>               Local vault directory (default: current directory)
  --dry-run                  Preview changes without making them
  --full                     Full sync: ignore cursor and hash cache, re-check every file
  --path <path>              Restrict sync to a specific file or folder (repeatable) (default: [])
  --plan-file <path>         Write dry-run plan to file (use with --dry-run) or read plan to execute (use with --execute)
  --execute                  Execute a previously written plan file (requires --plan-file)
  --conflict-choices <json>  Per-file conflict resolutions as JSON object, e.g. '{"file.md":"server"}' (use with --execute)
  -h, --help                 display help for command
```

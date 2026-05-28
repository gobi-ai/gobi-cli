# gobi vault

```
Usage: gobi vault [options] [command]

Vault commands (init, list, publish/unpublish profile, sync files).

Options:
  -h, --help                  display help for command

Commands:
  init                        Select or create the vault for the current directory. Writes .gobi/settings.yaml and seeds PUBLISH.md.
  create [options] <slug>     Create a new vault. <slug> must be unique (use 'gobi vault list' to see existing slugs); --name sets the display name. Does not change the configured vault — run 'gobi
                              vault init' or 'gobi vault set-primary' afterwards if you want to anchor to it.
  rename [options] <newName>  Rename a vault. Defaults to the configured vault (.gobi/settings.yaml); pass --vault-slug to target another. Does not affect PUBLISH.md frontmatter (which controls the
                              public profile title) — this is the local display name only.
  delete <slug>               Delete a vault. Irreversible. Slug must be passed explicitly (no .gobi fallback). The API will reject if the vault still owns content; clean up posts, members, and files
                              first.
  set-primary <slug>          Mark a vault as your primary. Unsets primary on the other vaults you own. Slug must be passed explicitly.
  list                        List vaults you own.
  status [options]            Show the configured vault's publish state and metadata (use before authoring a markdown artifact with --auto-attachments to confirm the vault is public).
  publish                     Upload PUBLISH.md to the vault root on webdrive. Triggers post-processing (vault sync, metadata update).
  unpublish                   Delete PUBLISH.md from the vault on webdrive.
  sync [options]              Sync local vault files with Gobi Webdrive.
  help [command]              display help for command
```

## init

```
Usage: gobi vault init [options]

Select or create the vault for the current directory. Writes .gobi/settings.yaml and seeds PUBLISH.md.

Options:
  -h, --help  display help for command
```

## create

```
Usage: gobi vault create [options] <slug>

Create a new vault. <slug> must be unique (use 'gobi vault list' to see existing slugs); --name sets the display name. Does not change the configured vault — run 'gobi vault init' or 'gobi vault
set-primary' afterwards if you want to anchor to it.

Options:
  --name <name>  Display name for the new vault
  -h, --help     display help for command
```

## rename

```
Usage: gobi vault rename [options] <newName>

Rename a vault. Defaults to the configured vault (.gobi/settings.yaml); pass --vault-slug to target another. Does not affect PUBLISH.md frontmatter (which controls the public profile title) — this is
the local display name only.

Options:
  --vault-slug <vaultSlug>  Vault slug to rename (defaults to .gobi/settings.yaml)
  -h, --help                display help for command
```

## delete

```
Usage: gobi vault delete [options] <slug>

Delete a vault. Irreversible. Slug must be passed explicitly (no .gobi fallback). The API will reject if the vault still owns content; clean up posts, members, and files first.

Options:
  -h, --help  display help for command
```

## set-primary

```
Usage: gobi vault set-primary [options] <slug>

Mark a vault as your primary. Unsets primary on the other vaults you own. Slug must be passed explicitly.

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

## status

```
Usage: gobi vault status [options]

Show the configured vault's publish state and metadata (use before authoring a markdown artifact with --auto-attachments to confirm the vault is public).

Options:
  --vault-slug <vaultSlug>  Vault slug to inspect (defaults to .gobi/settings.yaml)
  -h, --help                display help for command
```

## publish

```
Usage: gobi vault publish [options]

Upload PUBLISH.md to the vault root on webdrive. Triggers post-processing (vault sync, metadata update).

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

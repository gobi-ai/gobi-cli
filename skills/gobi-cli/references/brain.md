# gobi brain

```
Usage: gobi brain [options] [command]

Brain commands (search, ask, publish, unpublish, updates).

Options:
  -h, --help                          display help for command

Commands:
  search [options]                    Search brains across all spaces you are part of using text and semantic search.
  ask [options]                       Ask a brain a question. Creates a targeted session (1:1 conversation).
  publish                             Upload BRAIN.md to the vault root on webdrive. Triggers post-processing (brain sync, metadata update, Discord notification).
  unpublish                           Delete BRAIN.md from the vault on webdrive.
  list-updates [options]              List recent brain updates in a space (paginated).
  post-update [options]               Post a brain update in a space. Uses the vault from settings.
  edit-update [options] <updateId>    Edit a published brain update. You must be the author.
  delete-update [options] <updateId>  Delete a published brain update. You must be the author.
  help [command]                      display help for command
```

## search

```
Usage: gobi brain search [options]

Search brains across all spaces you are part of using text and semantic search.

Options:
  --query <query>  Search query
  -h, --help       display help for command
```

## ask

```
Usage: gobi brain ask [options]

Ask a brain a question. Creates a targeted session (1:1 conversation).

Options:
  --vault-slug <vaultSlug>  Slug of the brain/vault to ask
  --space-slug <spaceSlug>  Space slug where the brain belongs
  --question <question>     The question to ask (markdown supported)
  --mode <mode>             Session mode: "auto" or "manual"
  -h, --help                display help for command
```

## publish

```
Usage: gobi brain publish [options]

Upload BRAIN.md to the vault root on webdrive. Triggers post-processing (brain sync, metadata update, Discord notification).

Options:
  -h, --help  display help for command
```

## unpublish

```
Usage: gobi brain unpublish [options]

Delete BRAIN.md from the vault on webdrive.

Options:
  -h, --help  display help for command
```

## list-updates

```
Usage: gobi brain list-updates [options]

List recent brain updates in a space (paginated).

Options:
  --space-slug <spaceSlug>  Space slug
  --limit <number>          Items per page (default: "20")
  --offset <number>         Offset for pagination (default: "0")
  -h, --help                display help for command
```

## post-update

```
Usage: gobi brain post-update [options]

Post a brain update in a space. Uses the vault from settings.

Options:
  --space-slug <spaceSlug>  Space slug
  --vault-slug <vaultSlug>  Vault slug (overrides .gobi/settings.yaml)
  --title <title>           Title of the update
  --content <content>       Update content (markdown supported)
  -h, --help                display help for command
```

## edit-update

```
Usage: gobi brain edit-update [options] <updateId>

Edit a published brain update. You must be the author.

Options:
  --space-slug <spaceSlug>  Space slug
  --title <title>           New title for the update
  --content <content>       New content for the update (markdown supported)
  -h, --help                display help for command
```

## delete-update

```
Usage: gobi brain delete-update [options] <updateId>

Delete a published brain update. You must be the author.

Options:
  --space-slug <spaceSlug>  Space slug
  -h, --help                display help for command
```

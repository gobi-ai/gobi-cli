# gobi brain

```
Usage: gobi brain [options] [command]

Brain commands (search, ask, publish, unpublish).

Options:
  -h, --help        display help for command

Commands:
  search [options]  Search public brains by text and semantic similarity.
  ask [options]     Ask a brain a question. Creates a targeted session (1:1 conversation).
  publish           Upload BRAIN.md to the vault root on webdrive. Triggers post-processing (brain sync, metadata update, Discord notification).
  unpublish         Delete BRAIN.md from the vault on webdrive.
  help [command]    display help for command
```

## search

```
Usage: gobi brain search [options]

Search public brains by text and semantic similarity.

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
  --question <question>     The question to ask (markdown supported)
  --rich-text <richText>    Rich-text JSON array (e.g. [{"type":"text","text":"hello"}])
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

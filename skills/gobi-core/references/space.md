# gobi space

```
Usage: gobi space [options] [command]

Space commands (posts, replies). Space and member admin is web-UI only.

Options:
  --space-slug <spaceSlug>                    Space slug (overrides .gobi/settings.yaml)
  -h, --help                                  display help for command

Commands:
  list                                        List spaces you are a member of.
  warp [spaceSlug]                            Select the active space. Pass a slug to warp directly, or omit for interactive selection.
  create [options]                            Create a new space and become its owner.
  join <spaceSlug>                            Join an OPEN space by slug. Invite-only spaces need an invite link (open it on the web).
  help [command]                              display help for command
```

## list

```
Usage: gobi space list [options]

List spaces you are a member of.

Options:
  -h, --help  display help for command
```

## warp

```
Usage: gobi space warp [options] [spaceSlug]

Select the active space. Pass a slug to warp directly, or omit for interactive selection.

Options:
  -h, --help  display help for command
```

## create

```
Usage: gobi space create [options]

Create a new space and become its owner.

Options:
  --name <name>         Display name (e.g. "AI Researchers")
  --slug <slug>         URL-friendly slug: lowercase letters, digits, hyphens
  --description <text>  Optional description
  -h, --help            display help for command
```

## join

```
Usage: gobi space join [options] <spaceSlug>

Join an OPEN space by slug. Invite-only spaces need an invite link (open it on the web).

Options:
  -h, --help  display help for command
```

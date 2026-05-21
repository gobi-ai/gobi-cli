# gobi space

```
Usage: gobi space [options] [command]

Space commands (posts, replies). Space and member admin is web-UI only.

Options:
  --space-slug <spaceSlug>                Space slug (overrides .gobi/settings.yaml)
  -h, --help                              display help for command

Commands:
  list                                    List spaces you are a member of.
  warp [spaceSlug]                        Select the active space. Pass a slug to warp directly, or omit for interactive selection.
  help [command]                          display help for command
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

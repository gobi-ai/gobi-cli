# gobi space

```
Usage: gobi space [options] [command]

Space commands (posts, replies). Space and member admin is web-UI only.

Options:
  --space-slug <spaceSlug>                Space slug (overrides .gobi/settings.yaml)
  -h, --help                              display help for command

Commands:
  list                                    List spaces you are a member of.
  get [options] [spaceSlug]               Get details for a space. Pass a slug or omit to use the current space (from .gobi/settings.yaml or --space-slug).
  warp [spaceSlug]                        Select the active space. Pass a slug to warp directly, or omit for interactive selection.
  list-topics [options]                   List topics in a space, ordered by most recent content linkage.
  list-topic-posts [options] <topicSlug>  List posts tagged with a topic in a space (cursor-paginated).
  feed [options]                          List the unified feed (posts and replies, newest first) in a space.
  get-post [options] <postId>             Get a post with its ancestors and replies (paginated).
  list-posts [options]                    List posts in a space (paginated).
  create-post [options]                   Create a post in a space.
  edit-post [options] <postId>            Edit a post you authored in a space.
  delete-post [options] <postId>          Delete a post you authored in a space.
  create-reply [options] <postId>         Create a reply to a post in a space.
  edit-reply [options] <replyId>          Edit a reply you authored in a space.
  delete-reply [options] <replyId>        Delete a reply you authored in a space.
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

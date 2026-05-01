# gobi space

```
Usage: gobi space [options] [command]

Space commands (posts, replies). Space and member admin is web-UI only.

Options:
  --space-slug <slug>                     Space slug (overrides .gobi/settings.yaml)
  -h, --help                              display help for command

Commands:
  list                                    List spaces you are a member of.
  get [spaceSlug]                         Get details for a space. Pass a slug or omit to use the current space (from .gobi/settings.yaml or --space-slug).
  warp [spaceSlug]                        Select the active space. Pass a slug to warp directly, or omit for interactive selection.
  list-topics [options]                   List topics in a space, ordered by most recent content linkage.
  list-topic-posts [options] <topicSlug>  List posts tagged with a topic in a space (cursor-paginated).
  feed [options]                          List the unified feed (posts and replies, newest first) in a space.
  get-post [options] <postId>             Get a post with its ancestors and replies (paginated).
  list-posts [options]                    List posts in a space (paginated).
  create-post [options]                   Create a post in a space.
  edit-post [options] <postId>            Edit a post. You must be the author.
  delete-post <postId>                    Delete a post. You must be the author.
  create-reply [options] <postId>         Create a reply to a post in a space.
  edit-reply [options] <replyId>          Edit a reply. You must be the author.
  delete-reply <replyId>                  Delete a reply. You must be the author.
  help [command]                          display help for command
```

## get

```
Usage: gobi space get [options] [spaceSlug]

Get details for a space. Pass a slug or omit to use the current space (from .gobi/settings.yaml or --space-slug).

Options:
  -h, --help  display help for command
```

## list-topics

```
Usage: gobi space list-topics [options]

List topics in a space, ordered by most recent content linkage.

Options:
  --limit <number>  Max topics to return (0 = all) (default: "50")
  -h, --help        display help for command
```

## list-topic-posts

```
Usage: gobi space list-topic-posts [options] <topicSlug>

List posts tagged with a topic in a space (cursor-paginated).

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## feed

```
Usage: gobi space feed [options]

List the unified feed (posts and replies, newest first) in a space.

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## get-post

```
Usage: gobi space get-post [options] <postId>

Get a post with its ancestors and replies (paginated).

Options:
  --limit <number>   Replies per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## list-posts

```
Usage: gobi space list-posts [options]

List posts in a space (paginated).

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## create-post

```
Usage: gobi space create-post [options]

Create a post in a space.

Options:
  --title <title>           Title of the post
  --content <content>       Post content (markdown supported)
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before posting (also attributes the post to that vault)
  --vault-slug <vaultSlug>  Attribute the post to this vault (sets authorVaultId). Also used as upload destination for --auto-attachments.
  -h, --help                display help for command
```

## edit-post

```
Usage: gobi space edit-post [options] <postId>

Edit a post. You must be the author.

Options:
  --title <title>           New title for the post
  --content <content>       New content for the post (markdown supported)
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before editing (also attributes the post to that vault)
  --vault-slug <vaultSlug>  Attribute the post to this vault (sets authorVaultId). Also used as upload destination for --auto-attachments. Pass an empty string to detach.
  -h, --help                display help for command
```

## delete-post

```
Usage: gobi space delete-post [options] <postId>

Delete a post. You must be the author.

Options:
  -h, --help  display help for command
```

## create-reply

```
Usage: gobi space create-reply [options] <postId>

Create a reply to a post in a space.

Options:
  --content <content>  Reply content (markdown supported)
  -h, --help           display help for command
```

## edit-reply

```
Usage: gobi space edit-reply [options] <replyId>

Edit a reply. You must be the author.

Options:
  --content <content>       New content for the reply (markdown supported)
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before editing
  --vault-slug <vaultSlug>  Vault slug for attachment uploads (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## delete-reply

```
Usage: gobi space delete-reply [options] <replyId>

Delete a reply. You must be the author.

Options:
  -h, --help  display help for command
```

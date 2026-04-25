# gobi space

```
Usage: gobi space [options] [command]

Space commands (threads, replies). Space and member admin is web-UI only.

Options:
  --space-slug <slug>                       Space slug (overrides .gobi/settings.yaml)
  -h, --help                                display help for command

Commands:
  list                                      List spaces you are a member of.
  get [spaceSlug]                           Get details for a space. Pass a slug or omit to use the current space (from .gobi/settings.yaml or --space-slug).
  warp [spaceSlug]                          Select the active space. Pass a slug to warp directly, or omit for interactive selection.
  list-topics [options]                     List topics in a space, ordered by most recent content linkage.
  list-topic-threads [options] <topicSlug>  List threads tagged with a topic in a space (cursor-paginated).
  messages [options]                        List the unified message feed (threads and replies, newest first) in a space.
  ancestors <threadId>                      Show the ancestor lineage of a thread or reply (root → immediate parent).
  get-thread [options] <threadId>           Get a thread and its replies (paginated).
  list-threads [options]                    List threads in a space (paginated).
  create-thread [options]                   Create a thread in a space.
  edit-thread [options] <threadId>          Edit a thread. You must be the author.
  delete-thread <threadId>                  Delete a thread. You must be the author.
  create-reply [options] <threadId>         Create a reply to a thread in a space.
  edit-reply [options] <replyId>            Edit a reply. You must be the author.
  delete-reply <replyId>                    Delete a reply. You must be the author.
  help [command]                            display help for command
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

## list-topic-threads

```
Usage: gobi space list-topic-threads [options] <topicSlug>

List threads tagged with a topic in a space (cursor-paginated).

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## messages

```
Usage: gobi space messages [options]

List the unified message feed (threads and replies, newest first) in a space.

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## ancestors

```
Usage: gobi space ancestors [options] <threadId>

Show the ancestor lineage of a thread or reply (root → immediate parent).

Options:
  -h, --help  display help for command
```

## get-thread

```
Usage: gobi space get-thread [options] <threadId>

Get a thread and its replies (paginated).

Options:
  --limit <number>   Replies per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## list-threads

```
Usage: gobi space list-threads [options]

List threads in a space (paginated).

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## create-thread

```
Usage: gobi space create-thread [options]

Create a thread in a space.

Options:
  --title <title>           Title of the thread
  --content <content>       Thread content (markdown supported)
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before posting
  --vault-slug <vaultSlug>  Vault slug for attachment uploads (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## edit-thread

```
Usage: gobi space edit-thread [options] <threadId>

Edit a thread. You must be the author.

Options:
  --title <title>           New title for the thread
  --content <content>       New content for the thread (markdown supported)
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before editing
  --vault-slug <vaultSlug>  Vault slug for attachment uploads (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## delete-thread

```
Usage: gobi space delete-thread [options] <threadId>

Delete a thread. You must be the author.

Options:
  -h, --help  display help for command
```

## create-reply

```
Usage: gobi space create-reply [options] <threadId>

Create a reply to a thread in a space.

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

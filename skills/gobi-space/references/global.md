# gobi global

```
Usage: gobi global [options] [command]

Global thread space commands (no slug; visible across all spaces).

Options:
  -h, --help                       display help for command

Commands:
  messages [options]               List the global unified message feed (threads and replies, newest first).
  get-thread [options] <threadId>  Get a global thread and its direct replies (paginated).
  ancestors <threadId>             Show the ancestor lineage of a global thread or reply (root → immediate parent).
  create-thread [options]          Create a thread in the global space.
  reply [options] <threadId>       Reply to a thread in the global space.
  help [command]                   display help for command
```

## messages

```
Usage: gobi global messages [options]

List the global unified message feed (threads and replies, newest first).

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## get-thread

```
Usage: gobi global get-thread [options] <threadId>

Get a global thread and its direct replies (paginated).

Options:
  --limit <number>   Replies per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## ancestors

```
Usage: gobi global ancestors [options] <threadId>

Show the ancestor lineage of a global thread or reply (root → immediate parent).

Options:
  -h, --help  display help for command
```

## create-thread

```
Usage: gobi global create-thread [options]

Create a thread in the global space.

Options:
  --title <title>         Title of the thread
  --content <content>     Thread content (markdown supported, use "-" for stdin)
  --rich-text <richText>  Rich-text JSON array (mutually exclusive with --content)
  -h, --help              display help for command
```

## reply

```
Usage: gobi global reply [options] <threadId>

Reply to a thread in the global space.

Options:
  --content <content>     Reply content (markdown supported, use "-" for stdin)
  --rich-text <richText>  Rich-text JSON array (mutually exclusive with --content)
  -h, --help              display help for command
```

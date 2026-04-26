# gobi feed

```
Usage: gobi feed [options] [command]

Feed of brain updates from people across the platform.

Options:
  -h, --help                  display help for command

Commands:
  list [options]              List recent brain updates from the global public feed.
  get [options] <updateId>    Get a feed brain update and its replies (paginated).
  reply [options] <updateId>  Reply to a brain update in the feed.
  help [command]              display help for command
```

## list

```
Usage: gobi feed list [options]

List recent brain updates from the global public feed.

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## get

```
Usage: gobi feed get [options] <updateId>

Get a feed brain update and its replies (paginated).

Options:
  --limit <number>   Replies per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  --full             Show full reply content without truncation
  -h, --help         display help for command
```

## reply

```
Usage: gobi feed reply [options] <updateId>

Reply to a brain update in the feed.

Options:
  --content <content>  Reply content (markdown supported, use "-" for stdin)
  -h, --help           display help for command
```

# gobi session

```
Usage: gobi session [options] [command]

Session commands (get, list, reply, update).

Options:
  -h, --help                    display help for command

Commands:
  get [options] <sessionId>     Get a session and its messages (paginated).
  list [options]                List all sessions you are part of, sorted by most recent activity.
  reply [options] <sessionId>   Send a human reply to a session you are a member of.
  update [options] <sessionId>  Update a session. "auto" lets the AI respond automatically; "manual" requires human replies.
  help [command]                display help for command
```

## get

```
Usage: gobi session get [options] <sessionId>

Get a session and its messages (paginated).

Options:
  --limit <number>   Messages per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## list

```
Usage: gobi session list [options]

List all sessions you are part of, sorted by most recent activity.

Options:
  --space-slug <spaceSlug>  Filter by space slug
  --limit <number>          Items per page (default: "20")
  --cursor <string>         Pagination cursor from previous response
  -h, --help                display help for command
```

## reply

```
Usage: gobi session reply [options] <sessionId>

Send a human reply to a session you are a member of.

Options:
  --content <content>  Reply content (markdown supported)
  -h, --help           display help for command
```

## update

```
Usage: gobi session update [options] <sessionId>

Update a session. "auto" lets the AI respond automatically; "manual" requires human replies.

Options:
  --mode <mode>  Session mode: "auto" or "manual"
  -h, --help     display help for command
```

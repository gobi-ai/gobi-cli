# gobi draft

```
Usage: gobi draft [options] [command]

Drafts authored by your agent during chat. Each carries up to 3 AI-suggested actions. Top-5 pending feed the system prompt; picking an action posts a synthesized message into the originating session.

Options:
  -h, --help                            display help for command

Commands:
  list [options]                        List drafts (priority ASC, then newest first).
  get <draftId>                         Show one draft with its history and suggested actions.
  add [options] <title> <content>       Add a draft. Pass '-' for content to read from stdin. Pass --action up to 3 times to attach AI-suggested actions. Requires a chat session — the agent runtime
                                        exports GOBI_SESSION_ID automatically; outside that, pass --session.
  delete <draftId>                      Delete a draft.
  prioritize <draftId> <priority>       Set priority (lower = higher). Top 5 feed the system prompt.
  action <draftId> <actionIndex>        Take one of the draft's suggested actions by 0-based index. Marks the draft 'actioned' and the client posts the synthesized message into the originating
                                        session.
  revise [options] <draftId> <comment>  Bump the draft to a new revision. Comment is required. Pass --title, --content, and/or --action to update the draft in the same call (--action repeatable, max
                                        3, replaces all). Pass '-' for any of comment/title/content to read from stdin.
  help [command]                        display help for command
```

## list

```
Usage: gobi draft list [options]

List drafts (priority ASC, then newest first).

Options:
  --limit <number>  Max drafts to return (1-200) (default: "50")
  -h, --help        display help for command
```

## get

```
Usage: gobi draft get [options] <draftId>

Show one draft with its history and suggested actions.

Options:
  -h, --help  display help for command
```

## add

```
Usage: gobi draft add [options] <title> <content>

Add a draft. Pass '-' for content to read from stdin. Pass --action up to 3 times to attach AI-suggested actions. Requires a chat session — the agent runtime exports GOBI_SESSION_ID automatically;
outside that, pass --session.

Options:
  --session <sessionId>  Originating chat session UUID. Falls back to $GOBI_SESSION_ID when set.
  --priority <number>    Priority (lower = higher), default 100
  --action <label>       Suggested action label (repeatable, max 3). Each label is what the user sees on the button. (default: [])
  -h, --help             display help for command
```

## delete

```
Usage: gobi draft delete [options] <draftId>

Delete a draft.

Options:
  -h, --help  display help for command
```

## prioritize

```
Usage: gobi draft prioritize [options] <draftId> <priority>

Set priority (lower = higher). Top 5 feed the system prompt.

Options:
  -h, --help  display help for command
```

## action

```
Usage: gobi draft action [options] <draftId> <actionIndex>

Take one of the draft's suggested actions by 0-based index. Marks the draft 'actioned' and the client posts the synthesized message into the originating session.

Options:
  -h, --help  display help for command
```

## revise

```
Usage: gobi draft revise [options] <draftId> <comment>

Bump the draft to a new revision. Comment is required. Pass --title, --content, and/or --action to update the draft in the same call (--action repeatable, max 3, replaces all). Pass '-' for any of
comment/title/content to read from stdin.

Options:
  --title <title>      Replacement title
  --content <content>  Replacement content; pass '-' to read from stdin
  --action <label>     Replacement suggested action label (repeatable, max 3). When passed, replaces the entire actions array. (default: [])
  -h, --help           display help for command
```

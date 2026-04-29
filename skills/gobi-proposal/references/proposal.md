# gobi proposal

```
Usage: gobi proposal [options] [command]

Proposals authored by your agent during chat. Top-5 feed the system prompt; accept/reject/revise update state and the client posts the synthesized message into the session.

Options:
  -h, --help                          display help for command

Commands:
  list [options]                      List proposals (priority ASC, then newest first).
  get <proposalId>                    Show one proposal with its history.
  add [options] <title> <content>     Add a proposal. Pass '-' for content to read from stdin. Requires a chat session — the agent runtime exports GOBI_SESSION_ID automatically; outside that, pass
                                      --session.
  edit [options] <proposalId>         Replace proposal title and/or content (bumps revision). Pass '-' for stdin.
  delete <proposalId>                 Delete a proposal.
  prioritize <proposalId> <priority>  Set priority (lower = higher). Top 5 feed the system prompt.
  accept <proposalId>                 Mark the proposal accepted. The client posts the synthesized message into the session.
  reject <proposalId>                 Mark the proposal rejected. The client posts the synthesized message into the session.
  revise <proposalId> <comment>       Mark the proposal for revision and record the user's comment. The client posts the synthesized message into the session.
  help [command]                      display help for command
```

## list

```
Usage: gobi proposal list [options]

List proposals (priority ASC, then newest first).

Options:
  --limit <number>  Max proposals to return (1-200) (default: "50")
  -h, --help        display help for command
```

## get

```
Usage: gobi proposal get [options] <proposalId>

Show one proposal with its history.

Options:
  -h, --help  display help for command
```

## add

```
Usage: gobi proposal add [options] <title> <content>

Add a proposal. Pass '-' for content to read from stdin. Requires a chat session — the agent runtime exports GOBI_SESSION_ID automatically; outside that, pass --session.

Options:
  --session <sessionId>  Originating chat session UUID. Falls back to $GOBI_SESSION_ID when set.
  --priority <number>    Priority (lower = higher), default 100
  -h, --help             display help for command
```

## edit

```
Usage: gobi proposal edit [options] <proposalId>

Replace proposal title and/or content (bumps revision). Pass '-' for stdin.

Options:
  --title <title>      New title
  --content <content>  New content; pass '-' to read from stdin
  -h, --help           display help for command
```

## delete

```
Usage: gobi proposal delete [options] <proposalId>

Delete a proposal.

Options:
  -h, --help  display help for command
```

## prioritize

```
Usage: gobi proposal prioritize [options] <proposalId> <priority>

Set priority (lower = higher). Top 5 feed the system prompt.

Options:
  -h, --help  display help for command
```

## accept

```
Usage: gobi proposal accept [options] <proposalId>

Mark the proposal accepted. The client posts the synthesized message into the session.

Options:
  -h, --help  display help for command
```

## reject

```
Usage: gobi proposal reject [options] <proposalId>

Mark the proposal rejected. The client posts the synthesized message into the session.

Options:
  -h, --help  display help for command
```

## revise

```
Usage: gobi proposal revise [options] <proposalId> <comment>

Mark the proposal for revision and record the user's comment. The client posts the synthesized message into the session.

Options:
  -h, --help  display help for command
```

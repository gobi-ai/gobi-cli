# gobi proposal

```
Usage: gobi proposal [options] [command]

Proposals authored by your agent during chat. Top-5 feed the system prompt; accept/reject/revise post into the originating chat session.

Options:
  -h, --help                          display help for command

Commands:
  list [options]                      List proposals (priority ASC, then newest first).
  get <proposalId>                    Show one proposal with its history.
  add [options] <content>             Add a proposal directly. Pass '-' to read from stdin.
  edit <proposalId> <content>         Replace proposal content (bumps revision). Pass '-' for stdin.
  delete <proposalId>                 Delete a proposal.
  prioritize <proposalId> <priority>  Set priority (lower = higher). Top 5 feed the system prompt.
  accept <proposalId>                 Accept — posts "Accept your proposal X" into the originating chat session.
  reject <proposalId>                 Reject — posts "Reject your proposal X" into the originating chat session.
  revise <proposalId> <comment>       Ask the agent to revise — posts "Update your proposal X. Here's my comment. {comment}" into the chat session.
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
Usage: gobi proposal add [options] <content>

Add a proposal directly. Pass '-' to read from stdin.

Options:
  --session <sessionId>  Originate from a chat session (UUID)
  --priority <number>    Priority (lower = higher), default 100
  -h, --help             display help for command
```

## edit

```
Usage: gobi proposal edit [options] <proposalId> <content>

Replace proposal content (bumps revision). Pass '-' for stdin.

Options:
  -h, --help  display help for command
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

Accept — posts "Accept your proposal X" into the originating chat session.

Options:
  -h, --help  display help for command
```

## reject

```
Usage: gobi proposal reject [options] <proposalId>

Reject — posts "Reject your proposal X" into the originating chat session.

Options:
  -h, --help  display help for command
```

## revise

```
Usage: gobi proposal revise [options] <proposalId> <comment>

Ask the agent to revise — posts "Update your proposal X. Here's my comment. {comment}" into the chat session.

Options:
  -h, --help  display help for command
```

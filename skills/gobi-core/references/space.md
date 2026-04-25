# gobi space

```
Usage: gobi space [options] [command]

Space commands (threads, replies, members).

Options:
  --space-slug <slug>                       Space slug (overrides .gobi/settings.yaml)
  -h, --help                                display help for command

Commands:
  list                                      List spaces you are a member of.
  create [options]                          Create a new space.
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
  list-members [options]                    List members of a space (cursor-paginated).
  invite-member <email>                     Invite a user to the space by email (owner only).
  join-space                                Join a space via invite link.
  request-access                            Request access to a space.
  accept-invite                             Accept an invitation to a space.
  approve-member <userId>                   Approve a pending membership request (owner only).
  leave-space                               Leave a space.
  help [command]                            display help for command
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

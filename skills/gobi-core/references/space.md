# gobi space

```
Usage: gobi space [options] [command]

Space commands (threads, replies).

Options:
  --space-slug <slug>                       Space slug (overrides .gobi/settings.yaml)
  -h, --help                                display help for command

Commands:
  list                                      List spaces you are a member of.
  warp [spaceSlug]                          Select the active space. Pass a slug to warp directly, or omit for interactive selection.
  list-topics [options]                     List topics in a space, ordered by most recent content linkage.
  list-topic-threads [options] <topicSlug>  List threads tagged with a topic in a space (cursor-paginated).
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

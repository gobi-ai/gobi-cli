# gobi space

```
Usage: gobi space [options] [command]

Space commands (posts, replies). Space and member admin is web-UI only.

Options:
  --space-slug <spaceSlug>                Space slug (overrides .gobi/settings.yaml)
  -h, --help                              display help for command

Commands:
  get [options] [spaceSlug]               Get details for a space. Pass a slug or omit to use the current space (from .gobi/settings.yaml or --space-slug).
  list-topics [options]                   List topics in a space, ordered by most recent content linkage.
  list-topic-posts [options] <topicSlug>  List posts tagged with a topic in a space (cursor-paginated).
  feed [options]                          List the unified feed (posts and replies, newest first) in a space.
  get-post [options] <postId>             Get a post with its ancestors and replies (paginated).
  list-posts [options]                    List posts in a space (paginated).
  create-post [options]                   Create a post in a space.
  edit-post [options] <postId>            Edit a post you authored in a space.
  delete-post [options] <postId>          Delete a post you authored in a space.
  create-reply [options] <postId>         Create a reply to a post in a space.
  edit-reply [options] <replyId>          Edit a reply you authored in a space.
  delete-reply [options] <replyId>        Delete a reply you authored in a space.
  help [command]                          display help for command
```

## get

```
Usage: gobi space get [options] [spaceSlug]

Get details for a space. Pass a slug or omit to use the current space (from .gobi/settings.yaml or --space-slug).

Options:
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## list-topics

```
Usage: gobi space list-topics [options]

List topics in a space, ordered by most recent content linkage.

Options:
  --limit <number>          Items per page (default: "20")
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## list-topic-posts

```
Usage: gobi space list-topic-posts [options] <topicSlug>

List posts tagged with a topic in a space (cursor-paginated).

Options:
  --limit <number>          Items per page (default: "20")
  --cursor <string>         Pagination cursor from previous response
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## feed

```
Usage: gobi space feed [options]

List the unified feed (posts and replies, newest first) in a space.

Options:
  --limit <number>          Items per page (default: "20")
  --cursor <string>         Pagination cursor from previous response
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## get-post

```
Usage: gobi space get-post [options] <postId>

Get a post with its ancestors and replies (paginated).

Options:
  --limit <number>          Items per page (default: "20")
  --cursor <string>         Pagination cursor from previous response
  --full                    Show full reply content without truncation
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## list-posts

```
Usage: gobi space list-posts [options]

List posts in a space (paginated).

Options:
  --limit <number>          Items per page (default: "20")
  --cursor <string>         Pagination cursor from previous response
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## create-post

```
Usage: gobi space create-post [options]

Create a post in a space.

Options:
  --title <title>            Title of the post
  --content <content>        Post content (markdown supported, use "-" for stdin)
  --rich-text <richText>     Rich-text JSON array (mutually exclusive with --content)
  --auto-attachments         Upload wiki-linked [[files]] to webdrive before posting (also attributes the post to that vault)
  --vault-slug <vaultSlug>   Attribute the post to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.
  --space-slug <spaceSlug>   Space slug (overrides .gobi/settings.yaml)
  --draft-id <draftId>       Use this draft as the source of title and content (mutually exclusive with --title/--content/--rich-text). On success, links the post back by recording postId/spaceSlug
                             on draft.metadata so the client can render an 'Open post' button. The draft's vaultSlug seeds --vault-slug when not given explicitly.
  --attach <file>            Local media file to attach. Repeatable. X-style mix rule: up to 4 photos OR 1 GIF OR 1 video. Size ceilings: 5MB photos / 15MB GIFs / 512MB video. (default: [])
  --repost-post-id <postId>  Wrap an existing top-level post as the embedded card on this new post. Composes with --content / --rich-text / --attach (the wrapping author's text + media render above
                             the embedded card). Reposts-of-reposts are collapsed to the transitive root server-side. The referenced post must exist, not be deleted, and not itself be a reply.
  -h, --help                 display help for command
```

## edit-post

```
Usage: gobi space edit-post [options] <postId>

Edit a post you authored in a space.

Options:
  --title <title>           New title for the post
  --content <content>       New content for the post (markdown supported, use "-" for stdin)
  --rich-text <richText>    Rich-text JSON array (mutually exclusive with --content)
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before editing (also attributes the post to that vault)
  --vault-slug <vaultSlug>  Attribute the post to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## delete-post

```
Usage: gobi space delete-post [options] <postId>

Delete a post you authored in a space.

Options:
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## create-reply

```
Usage: gobi space create-reply [options] <postId>

Create a reply to a post in a space.

Options:
  --content <content>       Reply content (markdown supported, use "-" for stdin)
  --rich-text <richText>    Rich-text JSON array (mutually exclusive with --content)
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before posting (also attributes the reply to that vault)
  --vault-slug <vaultSlug>  Attribute the reply to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  --attach <file>           Local media file to attach to this reply. Repeatable. X-style mix rule: up to 4 photos OR 1 GIF OR 1 video. Size ceilings: 5MB photos / 15MB GIFs / 512MB video. (default:
                            [])
  -h, --help                display help for command
```

## edit-reply

```
Usage: gobi space edit-reply [options] <replyId>

Edit a reply you authored in a space.

Options:
  --content <content>       New content for the reply (markdown supported, use "-" for stdin)
  --rich-text <richText>    Rich-text JSON array (mutually exclusive with --content)
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before editing (also attributes the reply to that vault)
  --vault-slug <vaultSlug>  Attribute the reply to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## delete-reply

```
Usage: gobi space delete-reply [options] <replyId>

Delete a reply you authored in a space.

Options:
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

# gobi space

```
Usage: gobi space [options] [command]

Space commands (posts, replies). Space and member admin is web-UI only.

Options:
  --space-slug <spaceSlug>                    Space slug (overrides .gobi/settings.yaml)
  -h, --help                                  display help for command

Commands:
  get [options] [spaceSlug]                   Get details for a space. Pass a slug or omit to use the current space (from .gobi/settings.yaml or --space-slug).
  list-topics [options]                       List topics in a space, ordered by most recent content linkage.
  list-topic-posts [options] <topicSlug>      List posts tagged with a topic in a space (cursor-paginated).
  feed [options]                              List the unified feed (posts and replies, newest first) in a space.
  search-posts [options] <query>              Search a space's posts and replies (newest first). The query supports keywords plus from:<name> and topic:<tag> operators (quote multi-word values, e.g.
                                              from:"Jane Doe"). Each result is an individual post or reply, not a whole thread.
  get-post [options] <postId>                 Get a post with its ancestors and replies (paginated).
  list-posts [options]                        List posts in a space (paginated).
  create-post [options]                       Create a post in a space.
  edit-post [options] <postId>                Edit a post you authored in a space.
  delete-post [options] <postId>              Delete a post you authored in a space.
  create-reply [options] <postId>             Create a reply to a post in a space.
  edit-reply [options] <replyId>              Edit a reply you authored in a space.
  delete-reply [options] <replyId>            Delete a reply you authored in a space.
  react [options] <postId> <emoji>            Add an emoji reaction to a post or reply (idempotent). <postId> is the numeric id of a post OR a reply — the [p:N]/[r:N] ids shown in feed output.
  unreact [options] <postId> <emoji>          Remove your emoji reaction from a post or reply. <postId> is the numeric id of a post OR a reply.
  list-channels [options]                     List channels visible to you in a space (members: yours; space owner/admin: all). The main feed is not a channel — read it by omitting --channel on
                                              `feed`.
  get-channel [options] <channelId>           Get one channel (channel members, space owner/admin, or the agent on agent-enabled channels).
  list-channel-members [options] <channelId>  List the members of a channel.
  help [command]                              display help for command
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
  --channel <channelId>     Channel id to read instead of the main feed (see `list-channels`). Omit for the main feed.
  --all-channels            Read across the main feed AND every channel visible to you (all public channels + any you belong to). Overrides --channel.
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## search-posts

```
Usage: gobi space search-posts [options] <query>

Search a space's posts and replies (newest first). The query supports keywords plus from:<name> and topic:<tag> operators (quote multi-word values, e.g. from:"Jane Doe"). Each result is an individual
post or reply, not a whole thread.

Options:
  --limit <number>          Items per page (default: "20")
  --cursor <string>         Pagination cursor from previous response
  --channel <channelId>     Restrict results to one channel (see `list-channels`). Omit to search the main feed and all channels visible to you.
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
  --channel <channelId>     Channel id to read instead of the main feed (see `list-channels`). Omit for the main feed.
  --all-channels            Read across the main feed AND every channel visible to you (all public channels + any you belong to). Overrides --channel.
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
  --artifact <artifactId>    Attach an existing artifact to the post (repeatable). Create artifacts with `gobi space artifact create`. (default: [])
  --space-slug <spaceSlug>   Space slug (overrides .gobi/settings.yaml)
  --attach <file>            Local media or document file to attach. Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv) OR 1 GIF OR 1 video. Size ceilings: 10MB photos /
                             15MB GIFs / 512MB video / 250MB files. (default: [])
  --repost-post-id <postId>  Wrap an existing top-level post as the embedded card on this new post. Composes with --content / --rich-text / --attach (the wrapping author's text + media render above
                             the embedded card). Reposts-of-reposts are collapsed to the transitive root server-side. The referenced post must exist, not be deleted, and not itself be a reply.
  --channel <channelId>      Channel id to post into (see `list-channels`). Omit to post to the space's main feed. You must be able to see the channel (member, space owner/admin, or the space agent
                             on an agent-enabled channel).
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
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  --attach <file>           Replace the post's media attachments with the given files (existing attachments are removed). Repeatable. Mix rule: up to 4 photos + up to 4 document files
                            (pdf/md/txt/csv) OR 1 GIF OR 1 video. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files. Omit to leave attachments unchanged. (default: [])
  --artifact <artifactId>   Replace the post's artifact attachments with the given artifact(s) (existing artifact attachments are removed). Repeatable. Omit to leave them unchanged. Create artifacts
                            with `gobi space artifact create`. (default: [])
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
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  --attach <file>           Local media or document file to attach to this reply. Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv) OR 1 GIF OR 1 video. Size ceilings:
                            10MB photos / 15MB GIFs / 512MB video / 250MB files. (default: [])
  -h, --help                display help for command
```

## edit-reply

```
Usage: gobi space edit-reply [options] <replyId>

Edit a reply you authored in a space.

Options:
  --content <content>       New content for the reply (markdown supported, use "-" for stdin)
  --rich-text <richText>    Rich-text JSON array (mutually exclusive with --content)
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

## react

```
Usage: gobi space react [options] <postId> <emoji>

Add an emoji reaction to a post or reply (idempotent). <postId> is the numeric id of a post OR a reply — the [p:N]/[r:N] ids shown in feed output.

Options:
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## unreact

```
Usage: gobi space unreact [options] <postId> <emoji>

Remove your emoji reaction from a post or reply. <postId> is the numeric id of a post OR a reply.

Options:
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## list-channels

```
Usage: gobi space list-channels [options]

List channels visible to you in a space (members: yours; space owner/admin: all). The main feed is not a channel — read it by omitting --channel on `feed`.

Options:
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## get-channel

```
Usage: gobi space get-channel [options] <channelId>

Get one channel (channel members, space owner/admin, or the agent on agent-enabled channels).

Options:
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## list-channel-members

```
Usage: gobi space list-channel-members [options] <channelId>

List the members of a channel.

Options:
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

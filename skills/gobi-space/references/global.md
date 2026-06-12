# gobi global

```
Usage: gobi global [options] [command]

Global commands (posts and replies in the public feed across all vaults).

Options:
  -h, --help                       display help for command

Commands:
  feed [options]                   List the unified feed (posts and replies, newest first) in the global public feed.
  list-posts [options]             List posts in the global feed (paginated). Pass --mine to limit to your own posts.
  get-post [options] <postId>      Get a global post with its ancestors and replies (paginated).
  create-post [options]            Create a post in the global feed.
  edit-post [options] <postId>     Edit a post you authored in the global feed.
  delete-post <postId>             Delete a post you authored in the global feed.
  create-reply [options] <postId>  Create a reply to a post in the global feed.
  edit-reply [options] <replyId>   Edit a reply you authored in the global feed.
  delete-reply <replyId>           Delete a reply you authored in the global feed.
  react <postId> <emoji>           Add an emoji reaction to a global-feed post or reply (idempotent). <postId> is the numeric id of a post OR a reply — the [p:N]/[r:N] ids shown in feed output.
  unreact <postId> <emoji>         Remove your emoji reaction from a global-feed post or reply. <postId> is the numeric id of a post OR a reply.
  help [command]                   display help for command
```

## feed

```
Usage: gobi global feed [options]

List the unified feed (posts and replies, newest first) in the global public feed.

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  --following        Only include posts from authors you follow
  -h, --help         display help for command
```

## list-posts

```
Usage: gobi global list-posts [options]

List posts in the global feed (paginated). Pass --mine to limit to your own posts.

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  --mine             Only include posts authored by you
  -h, --help         display help for command
```

## get-post

```
Usage: gobi global get-post [options] <postId>

Get a global post with its ancestors and replies (paginated).

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  --full             Show full reply content without truncation
  -h, --help         display help for command
```

## create-post

```
Usage: gobi global create-post [options]

Create a post in the global feed.

Options:
  --title <title>            Title of the post
  --content <content>        Post content (markdown supported, use "-" for stdin)
  --rich-text <richText>     Rich-text JSON array (mutually exclusive with --content)
  --artifact <artifactId>    Attach an existing artifact to the post (repeatable). Create artifacts with `gobi artifact create`. (default: [])
  --attach <file>            Local media or document file to attach. Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv) OR 1 GIF OR 1 video. Size ceilings: 10MB photos /
                             15MB GIFs / 512MB video / 250MB files. (default: [])
  --repost-post-id <postId>  Wrap an existing top-level post as the embedded card on this new post. Composes with --content / --rich-text / --attach (the wrapping author's text + media render above
                             the embedded card). Reposts-of-reposts are collapsed to the transitive root server-side. The referenced post must exist, not be deleted, and not itself be a reply.
  -h, --help                 display help for command
```

## edit-post

```
Usage: gobi global edit-post [options] <postId>

Edit a post you authored in the global feed.

Options:
  --title <title>          New title
  --content <content>      New content (markdown supported, use "-" for stdin)
  --rich-text <richText>   Rich-text JSON array (mutually exclusive with --content)
  --attach <file>          Replace the post's media attachments with the given files (existing attachments are removed). Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv)
                           OR 1 GIF OR 1 video. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files. Omit to leave attachments unchanged. (default: [])
  --artifact <artifactId>  Replace the post's artifact attachments with the given artifact(s) (existing artifact attachments are removed). Repeatable. Omit to leave them unchanged. Create artifacts
                           with `gobi artifact create`. (default: [])
  -h, --help               display help for command
```

## delete-post

```
Usage: gobi global delete-post [options] <postId>

Delete a post you authored in the global feed.

Options:
  -h, --help  display help for command
```

## create-reply

```
Usage: gobi global create-reply [options] <postId>

Create a reply to a post in the global feed.

Options:
  --content <content>     Reply content (markdown supported, use "-" for stdin)
  --rich-text <richText>  Rich-text JSON array (mutually exclusive with --content)
  --attach <file>         Local media or document file to attach to this reply. Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv) OR 1 GIF OR 1 video. Size ceilings: 10MB
                          photos / 15MB GIFs / 512MB video / 250MB files. (default: [])
  -h, --help              display help for command
```

## edit-reply

```
Usage: gobi global edit-reply [options] <replyId>

Edit a reply you authored in the global feed.

Options:
  --content <content>     New reply content (markdown supported, use "-" for stdin)
  --rich-text <richText>  Rich-text JSON array (mutually exclusive with --content)
  -h, --help              display help for command
```

## delete-reply

```
Usage: gobi global delete-reply [options] <replyId>

Delete a reply you authored in the global feed.

Options:
  -h, --help  display help for command
```

## react

```
Usage: gobi global react [options] <postId> <emoji>

Add an emoji reaction to a global-feed post or reply (idempotent). <postId> is the numeric id of a post OR a reply — the [p:N]/[r:N] ids shown in feed output.

Options:
  -h, --help  display help for command
```

## unreact

```
Usage: gobi global unreact [options] <postId> <emoji>

Remove your emoji reaction from a global-feed post or reply. <postId> is the numeric id of a post OR a reply.

Options:
  -h, --help  display help for command
```

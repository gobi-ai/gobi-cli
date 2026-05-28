# gobi personal

```
Usage: gobi personal [options] [command]

Personal-space commands (private posts and replies visible only to you). Mirrors the `global` subcommand shape — posts/replies live in the same data model, scoped via personalSpaceUserId so they
never surface on the public feed.

Options:
  -h, --help                       display help for command

Commands:
  feed [options]                   List your personal-space feed (posts and replies, newest first). Only you can see these rows.
  list-posts [options]             List root posts (no replies) in your personal space. Filters the personal feed client-side; pagination cursor advances through the underlying feed page.
  get-post [options] <postId>      Get a personal-space post with its ancestors and replies (paginated). Same endpoint as `gobi global get-post`; only the owner can resolve a private id.
  create-post [options]            Create a private post in your personal space. Visible only to you.
  edit-post [options] <postId>     Edit a post you authored in your personal space.
  delete-post <postId>             Delete a post you authored in your personal space.
  create-reply [options] <postId>  Reply to a personal-space post. The reply inherits the parent's private scope automatically.
  edit-reply [options] <replyId>   Edit a reply you authored in your personal space.
  delete-reply <replyId>           Delete a reply you authored in your personal space.
  help [command]                   display help for command
```

## feed

```
Usage: gobi personal feed [options]

List your personal-space feed (posts and replies, newest first). Only you can see these rows.

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## list-posts

```
Usage: gobi personal list-posts [options]

List root posts (no replies) in your personal space. Filters the personal feed client-side; pagination cursor advances through the underlying feed page.

Options:
  --limit <number>   Items per page (applied to the underlying feed page) (default: "20")
  --cursor <string>  Pagination cursor from previous response
  -h, --help         display help for command
```

## get-post

```
Usage: gobi personal get-post [options] <postId>

Get a personal-space post with its ancestors and replies (paginated). Same endpoint as `gobi global get-post`; only the owner can resolve a private id.

Options:
  --limit <number>   Items per page (default: "20")
  --cursor <string>  Pagination cursor from previous response
  --full             Show full reply content without truncation
  -h, --help         display help for command
```

## create-post

```
Usage: gobi personal create-post [options]

Create a private post in your personal space. Visible only to you.

Options:
  --title <title>            Title of the post
  --content <content>        Post content (markdown supported, use "-" for stdin)
  --rich-text <richText>     Rich-text JSON array (mutually exclusive with --content)
  --artifact <artifactId>    Attach an existing artifact to the post (repeatable). Create artifacts with `gobi artifact create`. (default: [])
  --attach <file>            Local media file to attach. Repeatable. X-style mix rule: up to 4 photos OR 1 GIF OR 1 video. Size ceilings: 5MB photos / 15MB GIFs / 512MB video. (default: [])
  --repost-post-id <postId>  Wrap an existing top-level post as the embedded card on this new private post. The referenced post must be visible to you (your own personal-space post, a global-feed
                             post, or a post in a space you're a member of). Reposting someone else's personal-space post returns 404.
  -h, --help                 display help for command
```

## edit-post

```
Usage: gobi personal edit-post [options] <postId>

Edit a post you authored in your personal space.

Options:
  --title <title>         New title
  --content <content>     New content (markdown supported, use "-" for stdin)
  --rich-text <richText>  Rich-text JSON array (mutually exclusive with --content)
  --attach <file>         Replace the post's media attachments with the given files (existing attachments are removed). Repeatable. X-style mix rule: up to 4 photos OR 1 GIF OR 1 video. Size
                          ceilings: 5MB photos / 15MB GIFs / 512MB video. Omit to leave attachments unchanged. (default: [])
  -h, --help              display help for command
```

## delete-post

```
Usage: gobi personal delete-post [options] <postId>

Delete a post you authored in your personal space.

Options:
  -h, --help  display help for command
```

## create-reply

```
Usage: gobi personal create-reply [options] <postId>

Reply to a personal-space post. The reply inherits the parent's private scope automatically.

Options:
  --content <content>     Reply content (markdown supported, use "-" for stdin)
  --rich-text <richText>  Rich-text JSON array (mutually exclusive with --content)
  --attach <file>         Local media file to attach to this reply. Repeatable. X-style mix rule: up to 4 photos OR 1 GIF OR 1 video. Size ceilings: 5MB photos / 15MB GIFs / 512MB video. (default:
                          [])
  -h, --help              display help for command
```

## edit-reply

```
Usage: gobi personal edit-reply [options] <replyId>

Edit a reply you authored in your personal space.

Options:
  --content <content>     New reply content (markdown supported, use "-" for stdin)
  --rich-text <richText>  Rich-text JSON array (mutually exclusive with --content)
  -h, --help              display help for command
```

## delete-reply

```
Usage: gobi personal delete-reply [options] <replyId>

Delete a reply you authored in your personal space.

Options:
  -h, --help  display help for command
```

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
  create-post [options]            Create a post in the global feed. --vault-slug attributes it to a vault you own; defaults to your primary vault.
  edit-post [options] <postId>     Edit a post you authored in the global feed.
  delete-post <postId>             Delete a post you authored in the global feed.
  create-reply [options] <postId>  Create a reply to a post in the global feed.
  edit-reply [options] <replyId>   Edit a reply you authored in the global feed.
  delete-reply <replyId>           Delete a reply you authored in the global feed.
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
  --limit <number>          Items per page (default: "20")
  --cursor <string>         Pagination cursor from previous response
  --mine                    Only include posts authored by you
  --vault-slug <vaultSlug>  Filter by author vault slug
  -h, --help                display help for command
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

Create a post in the global feed. --vault-slug attributes it to a vault you own; defaults to your primary vault.

Options:
  --title <title>           Title of the post
  --content <content>       Post content (markdown supported, use "-" for stdin)
  --rich-text <richText>    Rich-text JSON array (mutually exclusive with --content)
  --vault-slug <vaultSlug>  Attribute the post to this vault (sets authorVaultSlug). Defaults to your primary vault.
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before posting (also sets authorVaultSlug to that vault)
  --draft-id <draftId>      Use this draft as the source of title and content (mutually exclusive with --title/--content/--rich-text). On success, links the post back by recording postId on
                            draft.metadata so the client can render an 'Open post' button. The draft's vaultSlug seeds --vault-slug when not given explicitly.
  --attach <file>           Local media file to attach. Repeatable. X-style mix rule: up to 4 photos OR 1 GIF OR 1 video. Size ceilings: 5MB photos / 15MB GIFs / 512MB video. (default: [])
  -h, --help                display help for command
```

## edit-post

```
Usage: gobi global edit-post [options] <postId>

Edit a post you authored in the global feed.

Options:
  --title <title>           New title
  --content <content>       New content (markdown supported, use "-" for stdin)
  --rich-text <richText>    Rich-text JSON array (mutually exclusive with --content)
  --vault-slug <vaultSlug>  Attribute the post to this vault (sets authorVaultSlug).
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before editing (uses --vault-slug or .gobi vault)
  -h, --help                display help for command
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
  --content <content>       Reply content (markdown supported, use "-" for stdin)
  --rich-text <richText>    Rich-text JSON array (mutually exclusive with --content)
  --vault-slug <vaultSlug>  Attribute the reply to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before posting (also attributes the reply to that vault)
  --attach <file>           Local media file to attach to this reply. Repeatable. X-style mix rule: up to 4 photos OR 1 GIF OR 1 video. Size ceilings: 5MB photos / 15MB GIFs / 512MB video. (default:
                            [])
  -h, --help                display help for command
```

## edit-reply

```
Usage: gobi global edit-reply [options] <replyId>

Edit a reply you authored in the global feed.

Options:
  --content <content>       New reply content (markdown supported, use "-" for stdin)
  --rich-text <richText>    Rich-text JSON array (mutually exclusive with --content)
  --vault-slug <vaultSlug>  Attribute the reply to this vault (sets authorVaultSlug). Also used as upload destination for --auto-attachments.
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before editing (also attributes the reply to that vault)
  -h, --help                display help for command
```

## delete-reply

```
Usage: gobi global delete-reply [options] <replyId>

Delete a reply you authored in the global feed.

Options:
  -h, --help  display help for command
```

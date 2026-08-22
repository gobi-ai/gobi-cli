# gobi personal

```
Usage: gobi personal [options] [command]

Personal-space commands (private posts and replies visible only to you). Posts/replies live in the same data model as space posts, scoped via personalSpaceUserId so they never surface on the public
feed.

Options:
  -h, --help                       display help for command

Commands:
  feed [options]                   List your personal-space feed (posts and replies, newest first). Only you can see these rows.
  search-posts [options] <query>   Search your personal-space posts and replies (newest first). The query supports keywords plus from:<name> and topic:<tag> operators (quote multi-word values). Each
                                   result is an individual post or reply, not a whole thread.
  list-posts [options]             List root posts (no replies) in your personal space. Filters the personal feed client-side; pagination cursor advances through the underlying feed page.
  get-post [options] <postId>      Get a personal-space post with its ancestors and replies (paginated). Only the owner can resolve a private id.
  create-post [options]            Create a private post in your personal space. Visible only to you.
  edit-post [options] <postId>     Edit a post you authored in your personal space.
  delete-post <postId>             Delete a post you authored in your personal space.
  create-reply [options] <postId>  Reply to a personal-space post. The reply inherits the parent's private scope automatically.
  edit-reply [options] <replyId>   Edit a reply you authored in your personal space.
  delete-reply <replyId>           Delete a reply you authored in your personal space.
  react <postId> <emoji>           Add an emoji reaction to a personal-space post or reply (idempotent). <postId> is the numeric id of a post OR a reply.
  unreact <postId> <emoji>         Remove your emoji reaction from a personal-space post or reply. <postId> is the numeric id of a post OR a reply.
  artifact                         Versioned creations attached to posts, held in your personal core / Home (visible only to you until you attach one to a post). Kinds: image | video | gif | markdown
                                   | note. Always human-owned; revisions form a history tree whose newest node is what the artifact reads as. There is no space-scoped equivalent — share one by
                                   attaching it to a post with `gobi space create-post --artifact <artifactId>`.
  activities                       Your Sense activities (what you were doing, from the wearable/app), browse-only. Every activity lands in your personal core / Home no matter which space was on
                                   screen when it was captured, so this is the only place they are listed.
  conversations                    Your Sense conversations (phone-mic Audio Logs + detected conversations), browse-only; transcript and audio stay owner-only. Every conversation lands in your
                                   personal core / Home regardless of the active space, so this is the only place they are listed.
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

## search-posts

```
Usage: gobi personal search-posts [options] <query>

Search your personal-space posts and replies (newest first). The query supports keywords plus from:<name> and topic:<tag> operators (quote multi-word values). Each result is an individual post or
reply, not a whole thread.

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

Get a personal-space post with its ancestors and replies (paginated). Only the owner can resolve a private id.

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
  --artifact <artifactId>    Attach an existing artifact to the post (repeatable). Create artifacts with `gobi personal artifact create`. (default: [])
  --attach <file>            Local media or document file to attach. Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv/html/docx, or any other non-media type) OR 1 GIF OR
                             1 video. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files. (default: [])
  --repost-post-id <postId>  Wrap an existing top-level post as the embedded card on this new private post. The referenced post must be visible to you (your own personal-space post, a public post, or
                             a post in a space you're a member of). Reposting someone else's personal-space post returns 404.
  -h, --help                 display help for command
```

## edit-post

```
Usage: gobi personal edit-post [options] <postId>

Edit a post you authored in your personal space.

Options:
  --title <title>          New title
  --content <content>      New content (markdown supported, use "-" for stdin)
  --rich-text <richText>   Rich-text JSON array (mutually exclusive with --content)
  --attach <file>          Replace the post's media attachments with the given files (existing attachments are removed). Repeatable. Mix rule: up to 4 photos + up to 4 document files
                           (pdf/md/txt/csv/html/docx, or any other non-media type) OR 1 GIF OR 1 video. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files. Omit to leave attachments
                           unchanged. (default: [])
  --artifact <artifactId>  Replace the post's artifact attachments with the given artifact(s) (existing artifact attachments are removed). Repeatable. Omit to leave them unchanged. Create artifacts
                           with `gobi personal artifact create`. (default: [])
  -h, --help               display help for command
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
  --attach <file>         Local media or document file to attach to this reply. Repeatable. Mix rule: up to 4 photos + up to 4 document files (pdf/md/txt/csv/html/docx, or any other non-media type)
                          OR 1 GIF OR 1 video. Size ceilings: 10MB photos / 15MB GIFs / 512MB video / 250MB files. (default: [])
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

## react

```
Usage: gobi personal react [options] <postId> <emoji>

Add an emoji reaction to a personal-space post or reply (idempotent). <postId> is the numeric id of a post OR a reply.

Options:
  -h, --help  display help for command
```

## unreact

```
Usage: gobi personal unreact [options] <postId> <emoji>

Remove your emoji reaction from a personal-space post or reply. <postId> is the numeric id of a post OR a reply.

Options:
  -h, --help  display help for command
```

## artifact

```
Usage: gobi personal artifact [options] [command]

Versioned creations attached to posts, held in your personal core / Home (visible only to you until you attach one to a post). Kinds: image | video | gif | markdown | note. Always human-owned;
revisions form a history tree whose newest node is what the artifact reads as. There is no space-scoped equivalent — share one by attaching it to a post with `gobi space create-post --artifact
<artifactId>`.

Options:
  -h, --help                       display help for command

Commands:
  create [options]                 Create an artifact. markdown/note/html kinds take a body via --file, --content, or stdin ("-"). image/gif/video kinds upload --file. Pass --post-id to attach the
                                   new artifact to a post.
  revise [options] <artifactId>    Edit an artifact: records a revision and makes it the current one. New body via --file, --content, or stdin (markdown), or --file (media). Use --from to branch off
                                   a specific revision.
  revert [options] <artifactId>    Restore an earlier revision's content as a new revision, which becomes the current one.
  history <artifactId>             List the artifact's full revision tree (owner only).
  download [options] <artifactId>  Download an artifact's content. markdown → write the body; media → fetch the bytes. Defaults to the current revision; pass --revision to pick one. Writes to --out
                                   or stdout (markdown).
  delete <artifactId>              Delete an artifact (and its revision tree).
  get <artifactId>                 Get one artifact with its current revision.
  list [options]                   List this scope's artifacts (newest first).
  help [command]                   display help for command
```

## activities

```
Usage: gobi personal activities [options] [command]

Your Sense activities (what you were doing, from the wearable/app), browse-only. Every activity lands in your personal core / Home no matter which space was on screen when it was captured, so this is
the only place they are listed.

Options:
  -h, --help               display help for command

Commands:
  list [options]           List Sense activities in this scope (newest first).
  get <activityId>         Get one activity's details (visible to you if you recorded it or are a member of its space).
  transcript <activityId>  Get an activity's transcript (owner-only; 403 for other space members).
  help [command]           display help for command
```

## conversations

```
Usage: gobi personal conversations [options] [command]

Your Sense conversations (phone-mic Audio Logs + detected conversations), browse-only; transcript and audio stay owner-only. Every conversation lands in your personal core / Home regardless of the
active space, so this is the only place they are listed.

Options:
  -h, --help            display help for command

Commands:
  list [options]        List conversations captured in this scope (newest first).
  get <conversationId>  Get a conversation's summary, side notes, linked note, and transcript (owner-only).
  help [command]        display help for command
```

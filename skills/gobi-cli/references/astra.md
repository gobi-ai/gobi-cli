# gobi astra

```
Usage: gobi astra [options] [command]

Astra commands (posts, sessions, brains, brain updates).

Options:
  --space-slug <slug>                     Space slug (overrides .gobi/settings.yaml)
  -h, --help                              display help for command

Commands:
  search-brain [options]                  Search brains (second brains/vaults) in a space using text and semantic search.
  ask-brain [options]                     Ask a brain a question. Creates a targeted session (1:1 conversation).
  publish-brain                           Upload BRAIN.md to the vault root on webdrive. Triggers post-processing (brain sync, metadata update, Discord notification).
  unpublish-brain                         Delete BRAIN.md from the vault on webdrive.
  get-post [options] <postId>             Get a post and its replies (paginated).
  list-posts [options]                    List posts in a space (paginated).
  create-post [options]                   Create a post in a space.
  edit-post [options] <postId>            Edit a post. You must be the author.
  delete-post <postId>                    Delete a post. You must be the author.
  list-replies [options] <postId>         List replies to a post (paginated).
  create-reply [options] <postId>         Create a reply to a post in a space.
  edit-reply [options] <replyId>          Edit a reply. You must be the author.
  delete-reply <replyId>                  Delete a reply. You must be the author.
  get-session [options] <sessionId>       Get a session and its messages (paginated).
  list-sessions [options]                 List all sessions you are part of, sorted by most recent activity.
  reply-session [options] <sessionId>     Send a human reply to a session you are a member of.
  update-session [options] <sessionId>    Update a session's mode. "auto" lets the AI respond automatically; "manual" requires human replies.
  list-brain-updates [options]            List recent brain updates in a space (paginated).
  create-brain-update [options]           Create a brain update in a space. Uses the vault from settings.
  edit-brain-update [options] <updateId>  Edit a published brain update. You must be the author.
  delete-brain-update <updateId>          Delete a published brain update. You must be the author.
  help [command]                          display help for command
```

## search-brain

```
Usage: gobi astra search-brain [options]

Search brains (second brains/vaults) in a space using text and semantic search.

Options:
  --query <query>  Search query
  -h, --help       display help for command
```

## ask-brain

```
Usage: gobi astra ask-brain [options]

Ask a brain a question. Creates a targeted session (1:1 conversation).

Options:
  --vault-slug <vaultSlug>  Slug of the brain/vault to ask
  --question <question>     The question to ask (markdown supported)
  --mode <mode>             Session mode: "auto" or "manual" (default: "auto")
  -h, --help                display help for command
```

## publish-brain

```
Usage: gobi astra publish-brain [options]

Upload BRAIN.md to the vault root on webdrive. Triggers post-processing (brain sync, metadata update, Discord notification).

Options:
  -h, --help  display help for command
```

## unpublish-brain

```
Usage: gobi astra unpublish-brain [options]

Delete BRAIN.md from the vault on webdrive.

Options:
  -h, --help  display help for command
```

## get-post

```
Usage: gobi astra get-post [options] <postId>

Get a post and its replies (paginated).

Options:
  --limit <number>   Replies per page (default: "20")
  --offset <number>  Offset for reply pagination (default: "0")
  -h, --help         display help for command
```

## list-posts

```
Usage: gobi astra list-posts [options]

List posts in a space (paginated).

Options:
  --limit <number>   Items per page (default: "20")
  --offset <number>  Offset for pagination (default: "0")
  -h, --help         display help for command
```

## create-post

```
Usage: gobi astra create-post [options]

Create a post in a space.

Options:
  --title <title>      Title of the post
  --content <content>  Post content (markdown supported)
  -h, --help           display help for command
```

## edit-post

```
Usage: gobi astra edit-post [options] <postId>

Edit a post. You must be the author.

Options:
  --title <title>      New title for the post
  --content <content>  New content for the post (markdown supported)
  -h, --help           display help for command
```

## delete-post

```
Usage: gobi astra delete-post [options] <postId>

Delete a post. You must be the author.

Options:
  -h, --help  display help for command
```

## list-replies

```
Usage: gobi astra list-replies [options] <postId>

List replies to a post (paginated).

Options:
  --limit <number>   Replies per page (default: "20")
  --offset <number>  Offset for reply pagination (default: "0")
  -h, --help         display help for command
```

## create-reply

```
Usage: gobi astra create-reply [options] <postId>

Create a reply to a post in a space.

Options:
  --content <content>  Reply content (markdown supported)
  -h, --help           display help for command
```

## edit-reply

```
Usage: gobi astra edit-reply [options] <replyId>

Edit a reply. You must be the author.

Options:
  --content <content>  New content for the reply (markdown supported)
  -h, --help           display help for command
```

## delete-reply

```
Usage: gobi astra delete-reply [options] <replyId>

Delete a reply. You must be the author.

Options:
  -h, --help  display help for command
```

## get-session

```
Usage: gobi astra get-session [options] <sessionId>

Get a session and its messages (paginated).

Options:
  --limit <number>   Messages per page (default: "20")
  --offset <number>  Offset for message pagination (default: "0")
  -h, --help         display help for command
```

## list-sessions

```
Usage: gobi astra list-sessions [options]

List all sessions you are part of, sorted by most recent activity.

Options:
  --limit <number>   Items per page (default: "20")
  --offset <number>  Offset for pagination (default: "0")
  -h, --help         display help for command
```

## reply-session

```
Usage: gobi astra reply-session [options] <sessionId>

Send a human reply to a session you are a member of.

Options:
  --content <content>  Reply content (markdown supported)
  -h, --help           display help for command
```

## update-session

```
Usage: gobi astra update-session [options] <sessionId>

Update a session's mode. "auto" lets the AI respond automatically; "manual" requires human replies.

Options:
  --mode <mode>  Session mode: "auto" or "manual"
  -h, --help     display help for command
```

## list-brain-updates

```
Usage: gobi astra list-brain-updates [options]

List recent brain updates in a space (paginated).

Options:
  --limit <number>   Items per page (default: "20")
  --offset <number>  Offset for pagination (default: "0")
  -h, --help         display help for command
```

## create-brain-update

```
Usage: gobi astra create-brain-update [options]

Create a brain update in a space. Uses the vault from settings.

Options:
  --vault-slug <vaultSlug>  Vault slug (overrides .gobi/settings.yaml)
  --title <title>           Title of the update
  --content <content>       Update content (markdown supported)
  -h, --help                display help for command
```

## edit-brain-update

```
Usage: gobi astra edit-brain-update [options] <updateId>

Edit a published brain update. You must be the author.

Options:
  --title <title>      New title for the update
  --content <content>  New content for the update (markdown supported)
  -h, --help           display help for command
```

## delete-brain-update

```
Usage: gobi astra delete-brain-update [options] <updateId>

Delete a published brain update. You must be the author.

Options:
  -h, --help  display help for command
```

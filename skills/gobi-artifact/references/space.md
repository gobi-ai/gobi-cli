# gobi space

```
Usage: gobi space [options] [command]

Space commands (posts, replies). Space and member admin is web-UI only.

Options:
  --space-slug <spaceSlug>   Space slug (overrides .gobi/settings.yaml)
  -h, --help                 display help for command

Commands:
  artifacts                  The space's artifacts: versioned documents or media made for an audience — posted to a feed, emailed, or opened from a link. Kinds: image | video | gif | markdown | note
                             | html. Revisions form a history tree whose newest node is what the artifact reads as. Attach one to a post with `gobi space posts create --artifact <artifactId>`.
  help [command]             display help for command
```

## artifacts

```
Usage: gobi space artifacts [options] [command]

The space's artifacts: versioned documents or media made for an audience — posted to a feed, emailed, or opened from a link. Kinds: image | video | gif | markdown | note | html. Revisions form a
history tree whose newest node is what the artifact reads as. Attach one to a post with `gobi space posts create --artifact <artifactId>`.

Options:
  -h, --help                       display help for command

Commands:
  create [options]                 Create an artifact. markdown/note/html kinds take a body via --file, --content, or stdin ("-"). image/gif/video kinds upload --file. Pass --post-id to attach the
                                   new artifact to a post.
  revise [options] <artifactId>    Edit an artifact: records a revision and makes it the current one. New body via --file, --content, or stdin (markdown/note/html), or --file (media). Use --from to
                                   branch off a specific revision.
  revert [options] <artifactId>    Restore an earlier revision's content as a new revision, which becomes the current one.
  history <artifactId>             List the artifact's full revision tree (owner only).
  download [options] <artifactId>  Download an artifact's content. markdown/note/html → write the body; image/gif/video → fetch the bytes. Defaults to the current revision; pass --revision to pick
                                   one. Writes to --out or stdout (text kinds).
  delete <artifactId>              Delete an artifact (and its revision tree).
  get <artifactId>                 Get one artifact with its current revision.
  list [options]                   List this scope's artifacts (newest first).
  help [command]                   display help for command
```

## artifacts create

```
Usage: gobi space artifacts create [options]

Create an artifact. markdown/note/html kinds take a body via --file, --content, or stdin ("-"). image/gif/video kinds upload --file. Pass --post-id to attach the new artifact to a post.

Options:
  --kind <kind>             Artifact kind: image | video | gif | markdown | note | html
  --file <path>             Local file: text body (markdown/note/html kinds) or media file (media kinds)
  --content <body>          Body inline (markdown/note/html kinds; pass "-" for stdin)
  --title <t>               Display title
  --vault-slug <slug>       Anchor vault for [[wikilink]] resolution (markdown kinds). Stored in metadata.vaultSlug.
  --post-id <id>            Attach the created artifact to this post afterward
  --auto-attachments        Upload wiki-linked [[files]] to webdrive before creating (markdown kinds; uses --vault-slug)
  --change-note <note>      Note describing this revision
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

## artifacts revise

```
Usage: gobi space artifacts revise [options] <artifactId>

Edit an artifact: records a revision and makes it the current one. New body via --file, --content, or stdin (markdown/note/html), or --file (media). Use --from to branch off a specific revision.

Options:
  --file <path>         Local file: text body (markdown/note/html kinds) or media file (media kinds)
  --content <body>      Body inline (markdown/note/html kinds; pass "-" for stdin)
  --change-note <note>  Note describing this revision
  --from <revisionId>   Branch off this revision instead of the current one
  --auto-attachments    Upload wiki-linked [[files]] to webdrive before revising (markdown kinds; uses the artifact's stored metadata.vaultSlug)
  -h, --help            display help for command
```

## artifacts revert

```
Usage: gobi space artifacts revert [options] <artifactId>

Restore an earlier revision's content as a new revision, which becomes the current one.

Options:
  --to <revisionId>  Revision to revert to
  -h, --help         display help for command
```

## artifacts history

```
Usage: gobi space artifacts history [options] <artifactId>

List the artifact's full revision tree (owner only).

Options:
  -h, --help  display help for command
```

## artifacts download

```
Usage: gobi space artifacts download [options] <artifactId>

Download an artifact's content. markdown/note/html → write the body; image/gif/video → fetch the bytes. Defaults to the current revision; pass --revision to pick one. Writes to --out or stdout (text
kinds).

Options:
  --revision <revisionId>  Specific revision (defaults to the artifact's current revision)
  --out <path>             Write to this file (text kinds default to stdout)
  -h, --help               display help for command
```

## artifacts delete

```
Usage: gobi space artifacts delete [options] <artifactId>

Delete an artifact (and its revision tree).

Options:
  -h, --help  display help for command
```

## artifacts get

```
Usage: gobi space artifacts get [options] <artifactId>

Get one artifact with its current revision.

Options:
  -h, --help  display help for command
```

## artifacts list

```
Usage: gobi space artifacts list [options]

List this scope's artifacts (newest first).

Options:
  --kind <kind>             Filter by kind: image | video | gif | markdown | note | html
  --limit <n>               Max items to return
  --space-slug <spaceSlug>  Space slug (overrides .gobi/settings.yaml)
  -h, --help                display help for command
```

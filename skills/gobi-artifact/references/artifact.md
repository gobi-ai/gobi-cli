# gobi artifact

```
Usage: gobi artifact [options] [command]

Versioned creations attached to posts. Kinds: image | video | gif | markdown | meeting_summary. Always human-owned; revisions form a draft/published tree (at most one published per artifact).

Options:
  -h, --help                       display help for command

Commands:
  create [options]                 Create an artifact. markdown/meeting_summary kinds take a body via --file, --content, or stdin ("-"). image/gif/video kinds upload --file. Pass --post-id to attach
                                   the new artifact to a post.
  revise [options] <artifactId>    Add a draft revision to an artifact. New body via --file, --content, or stdin (markdown), or --file (media). Use --from to branch off a specific revision.
  publish [options] <artifactId>   Publish a revision (becomes the artifact's single published revision).
  revert [options] <artifactId>    Revert the artifact's published pointer to an earlier revision.
  history <artifactId>             List the artifact's full revision tree (owner only).
  download [options] <artifactId>  Download an artifact's content. markdown → write the body; media → fetch the bytes. Defaults to the published/latest revision; pass --revision to pick one. Writes
                                   to --out or stdout (markdown).
  delete <artifactId>              Delete an artifact (and its revision tree).
  get <artifactId>                 Get one artifact with its current revision.
  list [options]                   List your artifacts (newest first).
  help [command]                   display help for command
```

## create

```
Usage: gobi artifact create [options]

Create an artifact. markdown/meeting_summary kinds take a body via --file, --content, or stdin ("-"). image/gif/video kinds upload --file. Pass --post-id to attach the new artifact to a post.

Options:
  --kind <kind>         Artifact kind: image | video | gif | markdown | meeting_summary
  --file <path>         Local file: markdown body (markdown kinds) or media file (media kinds)
  --content <md>        Markdown body inline (markdown kinds; pass "-" for stdin)
  --title <t>           Display title
  --vault-slug <slug>   Anchor vault for [[wikilink]] resolution (markdown kinds). Stored in metadata.vaultSlug.
  --post-id <id>        Attach the created artifact to this post afterward
  --auto-attachments    Upload wiki-linked [[files]] to webdrive before creating (markdown kinds; uses --vault-slug)
  --change-note <note>  Note describing this revision
  -h, --help            display help for command
```

## revise

```
Usage: gobi artifact revise [options] <artifactId>

Add a draft revision to an artifact. New body via --file, --content, or stdin (markdown), or --file (media). Use --from to branch off a specific revision.

Options:
  --file <path>         Local file: markdown body (markdown kinds) or media file (media kinds)
  --content <md>        Markdown body inline (markdown kinds; pass "-" for stdin)
  --change-note <note>  Note describing this revision
  --from <revisionId>   Branch the new draft off this revision (defaults to the latest)
  --auto-attachments    Upload wiki-linked [[files]] to webdrive before revising (markdown kinds; uses the artifact's stored metadata.vaultSlug)
  -h, --help            display help for command
```

## publish

```
Usage: gobi artifact publish [options] <artifactId>

Publish a revision (becomes the artifact's single published revision).

Options:
  --revision <revisionId>  Revision to publish
  -h, --help               display help for command
```

## revert

```
Usage: gobi artifact revert [options] <artifactId>

Revert the artifact's published pointer to an earlier revision.

Options:
  --to <revisionId>  Revision to revert to
  -h, --help         display help for command
```

## history

```
Usage: gobi artifact history [options] <artifactId>

List the artifact's full revision tree (owner only).

Options:
  -h, --help  display help for command
```

## download

```
Usage: gobi artifact download [options] <artifactId>

Download an artifact's content. markdown → write the body; media → fetch the bytes. Defaults to the published/latest revision; pass --revision to pick one. Writes to --out or stdout (markdown).

Options:
  --revision <revisionId>  Specific revision (defaults to the artifact's current revision)
  --out <path>             Write to this file (markdown defaults to stdout)
  -h, --help               display help for command
```

## delete

```
Usage: gobi artifact delete [options] <artifactId>

Delete an artifact (and its revision tree).

Options:
  -h, --help  display help for command
```

## get

```
Usage: gobi artifact get [options] <artifactId>

Get one artifact with its current revision.

Options:
  -h, --help  display help for command
```

## list

```
Usage: gobi artifact list [options]

List your artifacts (newest first).

Options:
  --kind <kind>  Filter by kind: image | video | gif | markdown | meeting_summary
  --limit <n>    Max items to return
  -h, --help     display help for command
```

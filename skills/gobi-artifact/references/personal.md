# gobi personal

```
Usage: gobi personal [options] [command]

Personal-space commands (private posts, replies, and a DM with your personal agent). Posts/replies live in the same data model as space posts, scoped via personalSpaceUserId so they never surface on
the public feed.

Options:
  -h, --help                       display help for command

Commands:
  artifact                         Versioned creations attached to posts, held in your personal core / Home (visible only to you until you attach one to a post). Kinds: image | video | gif | markdown
                                   | note. Always human-owned; revisions form a history tree whose newest node is what the artifact reads as. There is no space-scoped equivalent — share one by
                                   attaching it to a post with `gobi space create-post --artifact <artifactId>`.
  help [command]                   display help for command
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

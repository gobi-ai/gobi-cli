# gobi space

```
Usage: gobi space [options] [command]

Space commands (posts, replies). Space and member admin is web-UI only.

Options:
  --space-slug <spaceSlug>                    Space slug (overrides .gobi/settings.yaml)
  -h, --help                                  display help for command

Commands:
  artifact                                    Versioned creations attached to posts, scoped to this space (visible to its members). Kinds: image | video | gif | markdown | meeting_summary. Always
                                              human-owned; revisions form a draft/published tree (one published per artifact).
  help [command]                              display help for command
```

## artifact

```
Usage: gobi space artifact [options] [command]

Versioned creations attached to posts, scoped to this space (visible to its members). Kinds: image | video | gif | markdown | meeting_summary. Always human-owned; revisions form a draft/published
tree (one published per artifact).

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
  list [options]                   List this scope's artifacts (newest first).
  help [command]                   display help for command
```

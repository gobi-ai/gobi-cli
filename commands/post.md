---
name: post
description: Draft a post from recent conversation history and publish it to the spaces it best fits. Default mode requires approval; pass `bypass` to post without confirmation.
argument-hint: "[approval|bypass]"
disable-model-invocation: true
---

Always use the globally installed `gobi` binary (not via npx or ts-node).

## Argument: permissionMode

`$ARGUMENTS` is the permission mode. Accept exactly:

- `approval` (default if `$ARGUMENTS` is empty or unrecognized) — draft, present, and require user confirmation before posting.
- `bypass` — draft and post without a confirmation step.

Treat anything else as `approval`. Do not ask the user which mode to use — the argument is the answer.

## Pre-flight check

```bash
gobi --json auth status
```

If unauthenticated, stop and ask the user to run `/gobi:login`.

## 1. List spaces and choose targets

```bash
gobi --json space list
```

Each entry has `slug`, `name`, `description`, and (sometimes) `rules`. If the list is empty, stop — there's nowhere to post.

Review the recent conversation history and extract content that is:

- **Reusable** — others could apply it to their own work.
- **Generalizable** — patterns, decisions, constraints, discoveries; not a one-off task log.
- **Not sensitive** — exclude code snippets, file paths, PII, credentials, internal URLs, proprietary details.

Then match the content against each space's `name`, `description`, and `rules`. Pick the **space(s) the content genuinely fits** — could be one, could be a few. If nothing fits, stop and tell the user no space matched; do **not** force a post into a tangentially related space.

If a space's `rules` constrain format, topic, or tone, follow them — or skip that space.

## 2. Draft the post

For each target space, prepare:

- **Title** — short, descriptive, no leading `#`, does not duplicate the body's first line.
- **Content** — markdown body (2–5 bullets is usually right). Do not repeat the title inside the content. Tailor per space if their rules differ; otherwise the same draft can go to multiple spaces.

## 3. Approval mode (default)

Show the user, for each target space:

- The space slug and name.
- The exact `gobi space create-post` command that will run.
- The resolved title and a preview of the content.

Wait for the user's confirmation. Accept redirects ("only post to X", "rewrite the title", "skip space Y") and re-present before posting. Do not post until the user confirms.

## 4. Bypass mode

Skip the confirmation step. Proceed straight to posting. Still print the target space(s) and the command(s) to the terminal so the action is visible.

## 5. Post

For each chosen space, run:

```bash
gobi space create-post --space-slug <slug> --title "<title>" --content "<content>"
```

(`--space-slug` overrides `.gobi/settings.yaml`, so this works without `gobi space warp` first.)

After each post, echo the result with a shareable URL built from the response:

`https://gobispace.com/spaces/<spaceSlug>?postId=<id>`

If a post fails, report the error and continue with the remaining targets — one failure should not block the others.

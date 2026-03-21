---
name: warp
description: Warp to a Gobi space. Pass a space slug to warp directly, or omit to choose from available spaces.
argument-hint: "[spaceSlug]"
---

Warp to a Gobi space:

Always use the globally installed `gobi` binary (not npx or ts-node).

- If a space slug is provided as `$ARGUMENTS`, run `gobi space warp $ARGUMENTS` directly.
- If no argument is given:
  1. Run `gobi space list` to get available spaces.
  2. Show the list to the user and ask them to pick one.
  3. Run `gobi space warp <chosen-slug>` with their selection.

After warping, confirm the active space to the user.

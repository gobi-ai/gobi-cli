---
name: space-explore
description: Explore what's happening in the active Gobi space — posts and learnings shared by others.
argument-hint: "[keyword]"
---

Always use the installed `gobi` binary on your PATH (not via npx or ts-node).

Explore the active Gobi space to surface posts and learnings from others:

1. Run `gobi --json space posts recent --all-feeds` — recent posts and replies across the main feed and every feed visible to you.
2. Display results in a readable summary, grouped by feed.
3. If `$ARGUMENTS` is provided, run `gobi --json space posts search "$ARGUMENTS"` and highlight the matches.
4. Ask the user if they'd like to read anything in full:
   - For a space post: run `gobi space posts get <postId>` and show it with ancestors and replies.

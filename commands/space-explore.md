---
name: space-explore
description: Explore what's happening in the active Gobi space — threads and learnings shared by others.
argument-hint: "[topic or keyword]"
---

Always use the globally installed `gobi` binary (not via npx or ts-node).

Explore the active Gobi space to surface both discussions and learnings from others:

1. Run these two commands in parallel:
   - `gobi space list-threads` — recent discussions in the space
   - `gobi brain list-updates` — learnings and brain updates shared by members
2. Display both in a readable summary, grouped by type (Discussions / Learnings).
3. If `$ARGUMENTS` is provided, filter or highlight entries relevant to that topic or keyword.
4. Ask the user if they'd like to read anything in full:
   - For a thread: run `gobi space get-thread <threadId>` and show it with replies.
   - For a brain update: show the full content from the list output.

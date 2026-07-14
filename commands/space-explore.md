---
name: space-explore
description: Explore what's happening in the active Gobi space — posts and learnings shared by others.
argument-hint: "[topic or keyword]"
---

Always use the installed `gobi` binary on your PATH (not via npx or ts-node).

Explore the active Gobi space to surface posts, topics, and learnings from others:

1. Run these two commands in parallel:
   - `gobi --json space list-posts` — recent posts in the space
   - `gobi --json space list-topics` — available topics in the space
2. Display results in a readable summary, grouped by type (Topics / Space posts).
3. If `$ARGUMENTS` is provided, filter or highlight entries relevant to that topic or keyword. If a matching topic is found, also run `gobi --json space list-topic-posts <topicSlug>` to show posts tagged with that topic.
4. Ask the user if they'd like to read anything in full:
   - For a topic: run `gobi space list-topic-posts <topicSlug>` and show the posts.
   - For a space post: run `gobi space get-post <postId>` and show it with ancestors and replies.

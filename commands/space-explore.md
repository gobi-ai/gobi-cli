---
name: space-explore
description: Explore what's happening in the active Gobi space — threads and learnings shared by others.
argument-hint: "[topic or keyword]"
---

Always use the globally installed `gobi` binary (not via npx or ts-node).

Explore the active Gobi space to surface discussions, topics, and learnings from others:

1. Run these commands in parallel:
   - `gobi --json space messages` — unified feed of recent threads and replies in the space
   - `gobi --json space list-topics` — available topics across the platform
2. Display results in a readable summary, grouped by type (Topics / Discussions).
3. If `$ARGUMENTS` is provided, filter or highlight entries relevant to that topic or keyword. If a matching topic is found, also run `gobi --json space list-topic-threads <topicSlug>` to show threads tagged with that topic.
4. Ask the user if they'd like to read anything in full:
   - For a topic: run `gobi space list-topic-threads <topicSlug>` and show the threads.
   - For a thread: run `gobi space get-thread <threadId>` and show it with replies.

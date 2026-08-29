# gobi personal

```
Usage: gobi personal [options] [command]

Personal-space commands (private posts, replies, and DMs with your personal bots). Posts/replies live in the same data model as space posts, scoped via personalSpaceUserId so they never surface on
the public feed.

Options:
  -h, --help                       display help for command

Commands:
  activities                       Your Sense activities (what you were doing, from the wearable/app), browse-only. Every activity lands in your personal core / Home no matter which space was on
                                   screen when it was captured, so this is the only place they are listed.
  conversations                    Your Sense conversations (phone-mic Audio Logs + detected conversations), browse-only; transcript and audio stay owner-only. Personal-core rows (no space) are
                                   listed here. Conversations filed to a space are listed with `gobi space conversations`.
  help [command]                   display help for command
```

## activities

```
Usage: gobi personal activities [options] [command]

Your Sense activities (what you were doing, from the wearable/app), browse-only. Every activity lands in your personal core / Home no matter which space was on screen when it was captured, so this is
the only place they are listed.

Options:
  -h, --help        display help for command

Commands:
  list [options]    List Sense activities in this scope (newest first).
  get <activityId>  Get one activity's details (visible if you recorded it).
  help [command]    display help for command
```

## conversations

```
Usage: gobi personal conversations [options] [command]

Your Sense conversations (phone-mic Audio Logs + detected conversations), browse-only; transcript and audio stay owner-only. Personal-core rows (no space) are listed here. Conversations filed to a
space are listed with `gobi space conversations`.

Options:
  -h, --help            display help for command

Commands:
  list [options]        List conversations captured in this scope (newest first).
  get <conversationId>  Get a conversation's summary, side notes, linked note, and transcript (owner-only). <conversationId> is an opaque public id (o…).
  help [command]        display help for command
```

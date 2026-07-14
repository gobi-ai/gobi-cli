# gobi personal

```
Usage: gobi personal [options] [command]

Personal-space commands (private posts and replies visible only to you). Posts/replies live in the same data model as space posts, scoped via personalSpaceUserId so they never surface on the public
feed.

Options:
  -h, --help                       display help for command

Commands:
  activities                       Your personal Sense activities (what you were doing, from the wearable/app), browse-only. Recorded in your personal space (visible only to you).
  conversations                    Your personal Sense conversations (phone-mic Audio Logs + detected conversations), browse-only. Recorded in your personal space (visible only to you).
  help [command]                   display help for command
```

## activities

```
Usage: gobi personal activities [options] [command]

Your personal Sense activities (what you were doing, from the wearable/app), browse-only. Recorded in your personal space (visible only to you).

Options:
  -h, --help               display help for command

Commands:
  list [options]           List Sense activities in this scope (newest first).
  get <activityId>         Get one activity's details (visible to you if you recorded it or are a member of its space).
  transcript <activityId>  Get an activity's transcript (owner-only; 403 for other space members).
  help [command]           display help for command
```

## conversations

```
Usage: gobi personal conversations [options] [command]

Your personal Sense conversations (phone-mic Audio Logs + detected conversations), browse-only. Recorded in your personal space (visible only to you).

Options:
  -h, --help                   display help for command

Commands:
  list [options]               List conversations captured in this scope (newest first).
  transcript <conversationId>  Get a conversation's transcript and summary (owner-only).
  audio <conversationId>       Get a signed URL for a conversation's combined recording (owner-only; null for analyzer conversations).
  help [command]               display help for command
```

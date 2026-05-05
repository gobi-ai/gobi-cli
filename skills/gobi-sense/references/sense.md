# gobi sense

```
Usage: gobi sense [options] [command]

Sense commands (activities, transcriptions).

Options:
  -h, --help                     display help for command

Commands:
  list-activities [options]      List activity records within a time range.
  list-transcriptions [options]  List transcription records within a time range.
  help [command]                 display help for command
```

## list-activities

```
Usage: gobi sense list-activities [options]

List activity records within a time range.

Options:
  --start-time <iso>  Start of time range (ISO 8601 UTC, e.g. 2026-03-20T00:00:00Z)
  --end-time <iso>    End of time range (ISO 8601 UTC, e.g. 2026-03-20T23:59:59Z)
  -h, --help          display help for command
```

## list-transcriptions

```
Usage: gobi sense list-transcriptions [options]

List transcription records within a time range.

Options:
  --start-time <iso>  Start of time range (ISO 8601 UTC, e.g. 2026-03-20T00:00:00Z)
  --end-time <iso>    End of time range (ISO 8601 UTC, e.g. 2026-03-20T23:59:59Z)
  -h, --help          display help for command
```

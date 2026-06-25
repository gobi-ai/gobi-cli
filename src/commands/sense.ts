import { Command } from "commander";
import { apiGet } from "../client.js";
import { isJsonMode, jsonOut } from "./utils.js";

export function registerSenseCommand(program: Command): void {
  const sense = program
    .command("sense")
    .description("Sense commands (activities, transcriptions).");

  // ── Activities ──

  sense
    .command("list-activities")
    .description("List activity records within a time range.")
    .requiredOption("--start-time <iso>", "Start of time range (ISO 8601 UTC, e.g. 2026-03-20T00:00:00Z)")
    .requiredOption("--end-time <iso>", "End of time range (ISO 8601 UTC, e.g. 2026-03-20T23:59:59Z)")
    .action(async (opts: { startTime: string; endTime: string }) => {
      const params: Record<string, unknown> = {
        startTime: opts.startTime,
        endTime: opts.endTime,
      };

      const resp = (await apiGet("/app/activities", params)) as Record<string, unknown>;
      const strip = ({ id, device_id, created_at, updated_at, ...rest }: Record<string, unknown>) => rest;
      const allActivities = ((resp.activities as unknown[]) || []).map((a) => strip(a as Record<string, unknown>));
      const lastSeenTime = resp.latestTimestamp as string | undefined;

      // Pull out the last activity with null end_time as "last_activity"
      let lastActivityIdx = -1;
      for (let i = allActivities.length - 1; i >= 0; i--) {
        if (allActivities[i].end_time == null) { lastActivityIdx = i; break; }
      }
      const last_activity = lastActivityIdx !== -1 ? allActivities[lastActivityIdx] : undefined;
      const activities = lastActivityIdx !== -1
        ? allActivities.filter((_, i) => i !== lastActivityIdx)
        : allActivities;

      if (isJsonMode(sense)) {
        jsonOut({ activities, last_activity, lastSeenTime });
        return;
      }

      if (!activities.length && !last_activity) {
        console.log("No activities found.");
        if (lastSeenTime) console.log(`Latest data available: ${lastSeenTime}`);
        return;
      }

      if (last_activity) {
        console.log(`Last activity: [${last_activity.device_id}] ${last_activity.category}: ${last_activity.details} (${last_activity.start_time} → ongoing)`);
      }

      const lines = activities.map((a) => {
        const endStr = a.end_time ? ` → ${a.end_time}` : "";
        return `- [${a.device_id}] ${a.category}: ${a.details} (${a.start_time}${endStr})`;
      });

      if (lines.length) console.log(`Activities (${activities.length} items):\n` + lines.join("\n"));
      if (lastSeenTime) console.log(`Latest data available: ${lastSeenTime}`);
    });

  // ── Transcriptions ──

  sense
    .command("list-transcriptions")
    .description("List transcription records within a time range.")
    .requiredOption("--start-time <iso>", "Start of time range (ISO 8601 UTC, e.g. 2026-03-20T00:00:00Z)")
    .requiredOption("--end-time <iso>", "End of time range (ISO 8601 UTC, e.g. 2026-03-20T23:59:59Z)")
    .action(async (opts: { startTime: string; endTime: string }) => {
      const params: Record<string, unknown> = {
        startTime: opts.startTime,
        endTime: opts.endTime,
      };

      const resp = (await apiGet("/app/transcriptions", params)) as Record<string, unknown>;
      const transcriptions = ((resp.transcriptions as unknown[]) || []) as Record<string, unknown>[];
      const lastSeenTime = resp.latestTimestamp as string | undefined;

      // Flatten all turns across transcription records. The backend returns one
      // clean turn per entry ({speaker, timestamp, text}); `speaker` is a raw
      // token ("0", "Mika:42", "Me:42", "uv:7", …) we turn into a label below.
      interface FlatTurn { speaker: string; timestamp: string; text: string }
      const allTurns: FlatTurn[] = [];

      for (const t of transcriptions) {
        const rawTurns = ((t.turns as unknown[]) || []) as Record<string, unknown>[];
        for (const turn of rawTurns) {
          const text = String(turn.text ?? "").trim();
          if (!text) continue;
          allTurns.push({
            speaker: String(turn.speaker ?? ""),
            timestamp: String(turn.timestamp ?? ""),
            text,
          });
        }
      }

      // Filter to requested time range and sort by time.
      const startMs = new Date(opts.startTime).getTime();
      const endMs = new Date(opts.endTime).getTime();
      const filtered = allTurns
        .filter((t) => {
          const ts = new Date(t.timestamp).getTime();
          return ts >= startMs && ts <= endMs;
        })
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // Friendly speaker labels: named voices → their name, the user → "Me",
      // anonymous voices (bare index, Person:/uv:) → a stable "Speaker N"
      // numbered by first appearance across the sorted transcript.
      const anonOrdinals = new Map<string, number>();
      let nextOrdinal = 1;
      const labelFor = (token: string): string => {
        const named = token.match(/^(.+):(\d+)$/);
        if (named) {
          const name = named[1].trim();
          if (name === "Me") return "Me";
          if (name && name !== "Person" && name !== "uv") return name;
        }
        if (!anonOrdinals.has(token)) anonOrdinals.set(token, nextOrdinal++);
        return `Speaker ${anonOrdinals.get(token)}`;
      };

      if (isJsonMode(sense)) {
        jsonOut({
          transcriptions: filtered.map((t) => ({ ...t, speaker: labelFor(t.speaker) })),
          lastSeenTime,
        });
        return;
      }

      if (!filtered.length) {
        console.log("No transcriptions found.");
        if (lastSeenTime) console.log(`Latest data available: ${lastSeenTime}`);
        return;
      }

      const lines = filtered.map((t) => `- ${labelFor(t.speaker)} (${t.timestamp}): ${t.text}`);
      console.log(`Transcriptions (${filtered.length} turns):\n` + lines.join("\n"));
      if (lastSeenTime) console.log(`Latest data available: ${lastSeenTime}`);
    });
}

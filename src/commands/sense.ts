import { Command } from "commander";
import { apiGet } from "../client.js";
import { isJsonMode, jsonOut } from "./utils.js";

export function registerSenseCommand(program: Command): void {
  const sense = program
    .command("sense")
    .description("Sense commands (activities, transcriptions).");

  // ── Activities ──

  sense
    .command("activities")
    .description("Fetch activity records within a time range.")
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
      const latestTimestamp = resp.latestTimestamp as string | undefined;

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
        jsonOut({ activities, last_activity, latestTimestamp });
        return;
      }

      if (!activities.length && !last_activity) {
        console.log("No activities found.");
        if (latestTimestamp) console.log(`Latest data available: ${latestTimestamp}`);
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
      if (latestTimestamp) console.log(`Latest data available: ${latestTimestamp}`);
    });

  // ── Transcriptions ──

  sense
    .command("transcriptions")
    .description("Fetch transcription records within a time range.")
    .requiredOption("--start-time <iso>", "Start of time range (ISO 8601 UTC, e.g. 2026-03-20T00:00:00Z)")
    .requiredOption("--end-time <iso>", "End of time range (ISO 8601 UTC, e.g. 2026-03-20T23:59:59Z)")
    .action(async (opts: { startTime: string; endTime: string }) => {
      const params: Record<string, unknown> = {
        startTime: opts.startTime,
        endTime: opts.endTime,
      };

      const resp = (await apiGet("/app/transcriptions", params)) as Record<string, unknown>;
      const transcriptions = ((resp.transcriptions as unknown[]) || []) as Record<string, unknown>[];
      const latestTimestamp = resp.latestTimestamp as string | undefined;

      // Flatten all turns across all transcription records into {speaker, timestamp, text}
      interface FlatTurn { speaker: unknown; timestamp: string; text: string }
      const allTurns: FlatTurn[] = [];

      for (const t of transcriptions) {
        const rawTurns = ((t.turns as unknown[]) || []) as Record<string, unknown>[];
        for (const turn of rawTurns) {
          const lines = String(turn.text ?? "").split("\n");
          for (const line of lines) {
            if (!line.trim() || line.trim() === "uv:") continue;

            // Me@<timestamp>: <text>
            const meMatch = line.match(/^Me@(\S+):\s*(.*)/);
            if (meMatch) {
              allTurns.push({ speaker: "Me", timestamp: meMatch[1], text: meMatch[2] });
              continue;
            }

            allTurns.push({ speaker: turn.speaker, timestamp: turn.timestamp as string, text: line });
          }
        }
      }

      // Filter to requested time range and sort
      const startMs = new Date(opts.startTime).getTime();
      const endMs = new Date(opts.endTime).getTime();
      const filtered = allTurns
        .filter((t) => {
          const ts = new Date(t.timestamp).getTime();
          return ts >= startMs && ts <= endMs;
        })
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      if (isJsonMode(sense)) {
        jsonOut({ transcriptions: filtered, latestTimestamp });
        return;
      }

      if (!filtered.length) {
        console.log("No transcriptions found.");
        if (latestTimestamp) console.log(`Latest data available: ${latestTimestamp}`);
        return;
      }

      const lines = filtered.map((t) => `- Speaker ${t.speaker} (${t.timestamp}): ${t.text}`);
      console.log(`Transcriptions (${filtered.length} turns):\n` + lines.join("\n"));
      if (latestTimestamp) console.log(`Latest data available: ${latestTimestamp}`);
    });
}

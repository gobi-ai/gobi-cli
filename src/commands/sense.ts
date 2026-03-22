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
      const activities = ((resp.activities as unknown[]) || []) as Record<string, unknown>[];
      const pagination = (resp.pagination || {}) as Record<string, unknown>;
      const latestTimestamp = resp.latestTimestamp as string | undefined;

      if (isJsonMode(sense)) {
        jsonOut({ activities, pagination, latestTimestamp });
        return;
      }

      if (!activities.length) {
        console.log("No activities found.");
        if (latestTimestamp) console.log(`Latest data available: ${latestTimestamp}`);
        return;
      }

      const lines = activities.map((a) => {
        const endStr = a.end_time ? ` → ${a.end_time}` : "";
        return `- [${a.device_id}] ${a.category}: ${a.details} (${a.start_time}${endStr})`;
      });

      console.log(`Activities (${activities.length} items):\n` + lines.join("\n"));
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
      const pagination = (resp.pagination || {}) as Record<string, unknown>;
      const latestTimestamp = resp.latestTimestamp as string | undefined;

      if (isJsonMode(sense)) {
        jsonOut({ transcriptions, pagination, latestTimestamp });
        return;
      }

      if (!transcriptions.length) {
        console.log("No transcriptions found.");
        if (latestTimestamp) console.log(`Latest data available: ${latestTimestamp}`);
        return;
      }

      const lines: string[] = [];
      for (const t of transcriptions) {
        lines.push(`- [${t.device_id}] ${t.created_at}`);
        const turns = ((t.turns as unknown[]) || []) as Record<string, unknown>[];
        for (const turn of turns) {
          lines.push(`    Speaker ${turn.speaker} (${turn.timestamp}): ${turn.text}`);
        }
      }

      console.log(`Transcriptions (${transcriptions.length} items):\n` + lines.join("\n"));
      if (latestTimestamp) console.log(`Latest data available: ${latestTimestamp}`);
    });
}

import type { McpServer } from "@modelcontextprotocol/server";
import type { GobiApi } from "./gobi-client.js";
import { fetchPersonalContext } from "./gobi-personal.js";

export const DAILY_SNAPSHOT_URI = "gobi://personal/daily-snapshot";

export function registerGobiResources(server: McpServer, api: GobiApi): void {
  server.registerResource(
    "gobi-personal-daily-snapshot",
    DAILY_SNAPSHOT_URI,
    {
      title: "Personal daily snapshot",
      description:
        "Last 24 hours of Gobi personal context: current activity, recent activities, notes with summaries and speakers, and fresh Sense captures. Same payload as gobi_get_personal_context with since=24h. Read this for the daily snapshot / Active Memory refresh.",
      mimeType: "application/json",
    },
    async (uri) => {
      const ctx = await fetchPersonalContext(api, { since: "24h" });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(ctx, null, 2),
          },
        ],
      };
    },
  );
}

import type { McpServer } from "@modelcontextprotocol/server";

export const PROMPT_NAMES = ["catch-up", "evening-debrief", "people-met-today"] as const;

export function registerGobiPrompts(server: McpServer): void {
  server.registerPrompt(
    "catch-up",
    {
      title: "Catch-up greeting",
      description:
        "Session-start catch-up: ground a greeting in what actually happened (who they saw, what they were doing, an open loop). Never a generic hello.",
    },
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Start-of-session catch-up.

1. Call gobi_get_personal_context (default last 24h) BEFORE greeting, calendar, or memory.
2. Then gobi_get_note on one to three recent substantive notes (skip empty/processing ones).
3. Ground the greeting in what actually happened — who they saw, what they were doing, an open loop. Never "Hey, how can I help?"
4. Apply the interruptibility gate: if they are in a meeting, conversation, driving, exercise, or sleep, keep the greeting minimal and do not pile on questions.
5. If something looks help-able, offer 1–3 options and ask "도와줄까?" — do not act until they consent.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "evening-debrief",
    {
      title: "Evening debrief",
      description:
        "End-of-day unclosed-loops debrief: commitments, ready-to-send follow-up drafts (in chat only), and exactly one clarifying question.",
    },
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Evening unclosed-loops debrief.

1. Call gobi_get_personal_context with since=24h (or read gobi://personal/daily-snapshot). Then gobi_get_note for commitments you cannot see from summaries.
2. List commitments of the day (from notes + anything you already remember).
3. Draft ready-to-send follow-ups in chat only — this MCP server is read-only; do not send, post, or email.
4. Ask exactly one clarifying question.
5. Offer 1–3 next steps and ask "도와줄까?" Act only after consent.
6. If they are still in a meeting, conversation, driving, exercise, or sleep, wait — do not debrief during DND.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "people-met-today",
    {
      title: "People met today",
      description:
        "Who the user met or talked to today, from Gobi notes (speakers / summaries). There is no people-directory tool.",
    },
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Who did I meet or talk to today?

1. Call gobi_get_personal_context FIRST (examples this answers: "who did I just meet", "who did I talk to earlier"). Do this before calendar or memory.
2. Use note speakers and summaries. gobi_get_note for a transcript only when the summary is not enough.
3. There is no people-directory or search_notes tool — do not invent one. Hold names, roles, and one-line highlights in your own memory.
4. If a recent substantive conversation still has unnamed speakers ("Speaker N" / "Unknown"), ask who they were.
5. Prefer a short people list over dumping transcripts.`,
          },
        },
      ],
    }),
  );
}

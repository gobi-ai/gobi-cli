import { Command } from "commander";
import { apiDelete, apiGet, apiPatch, apiPost } from "../client.js";
import { isJsonMode, jsonOut, readStdin, unwrapResp } from "./utils.js";

interface DraftAction {
  label: string;
}

interface DraftHistoryEvent {
  type: "created" | "revised" | "actioned" | "prioritized";
  revision: number;
  title?: string;
  content?: string;
  actions?: DraftAction[];
  comment?: string;
  priority?: number;
  actionIndex?: number;
  actionLabel?: string;
  createdAt: string;
}

interface Draft {
  id: number;
  draftId: string;
  userId: number;
  sessionId: string;
  revision: number;
  priority: number;
  title: string;
  content: string;
  actions: DraftAction[];
  history: DraftHistoryEvent[];
  status: "pending" | "actioned";
  createdAt: string;
  updatedAt: string;
}

function readContent(value: string): string {
  if (value === "-") return readStdin();
  return value;
}

function snippet(content: string, max = 80): string {
  const single = content.replace(/\s+/g, " ");
  return single.length > max ? `${single.slice(0, max)}…` : single;
}

function parseActionFlags(values: string[] | undefined): DraftAction[] {
  if (!values) return [];
  return values
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((label) => ({ label }));
}

function formatDraftLine(d: Draft): string {
  const status = d.status === "pending" ? "·" : "✓";
  const actionCount = d.actions.length;
  return `- [${status}] p${d.priority} rev${d.revision} ${d.draftId.slice(0, 8)}  ${snippet(d.title)} (${actionCount} action${actionCount === 1 ? "" : "s"})`;
}

export function registerDraftCommand(program: Command): void {
  // The draft command surface is designed for agent use: every subcommand
  // accepts `--json` (set globally) and returns the same envelope shape, and
  // the agent-authoring flow funnels through `add` + `revise` while user-
  // facing decisions go through `action` and `revise` (with --comment).
  const draft = program
    .command("draft")
    .description(
      "Drafts authored by your agent during chat. Each carries up to 3 AI-suggested actions. Top-5 pending feed the system prompt; picking an action posts a synthesized message into the originating session.",
    );

  // ── List ──

  draft
    .command("list")
    .description("List drafts (priority ASC, then newest first).")
    .option("--limit <number>", "Max drafts to return (1-200)", "50")
    .action(async (opts: { limit: string }) => {
      const params = { limit: parseInt(opts.limit, 10) };
      const resp = (await apiGet("/app/drafts", params)) as Record<string, unknown>;
      const items = ((resp.data as unknown[]) || []) as Draft[];

      if (isJsonMode(draft)) {
        jsonOut(items);
        return;
      }

      if (!items.length) {
        console.log("No drafts.");
        return;
      }

      console.log(`Drafts (${items.length}):`);
      for (const d of items) console.log(formatDraftLine(d));
    });

  // ── Get ──

  draft
    .command("get <draftId>")
    .description("Show one draft with its history and suggested actions.")
    .action(async (draftId: string) => {
      const resp = (await apiGet(`/app/drafts/${draftId}`)) as Record<string, unknown>;
      const d = unwrapResp(resp) as Draft;

      if (isJsonMode(draft)) {
        jsonOut(d);
        return;
      }

      console.log(`Draft ${d.draftId}`);
      console.log(`  title:    ${d.title}`);
      console.log(`  status:   ${d.status}`);
      console.log(`  priority: ${d.priority}`);
      console.log(`  revision: ${d.revision}`);
      console.log(`  session:  ${d.sessionId}`);
      console.log(`  created:  ${d.createdAt}`);
      console.log("");
      console.log("Content:");
      console.log(d.content);
      if (d.actions.length) {
        console.log("");
        console.log("Suggested actions:");
        d.actions.forEach((a, i) => console.log(`  [${i}] ${a.label}`));
      }
      if (d.history.length) {
        console.log("");
        console.log("History:");
        for (const h of d.history) {
          console.log(`  ${h.createdAt}  rev${h.revision}  ${h.type}`);
          if (h.type === "created" || h.type === "revised") {
            if (h.title !== undefined) console.log(`    title:   ${h.title}`);
            if (h.content !== undefined) {
              console.log(`    content: ${snippet(h.content, 200)}`);
            }
            if (h.actions !== undefined && h.actions.length) {
              console.log(`    actions: ${h.actions.map((a) => a.label).join(" | ")}`);
            }
            if (h.comment !== undefined) console.log(`    comment: ${h.comment}`);
          } else if (h.type === "prioritized" && h.priority !== undefined) {
            console.log(`    priority=${h.priority}`);
          } else if (h.type === "actioned") {
            console.log(`    action[${h.actionIndex}]=${h.actionLabel}`);
          }
        }
      }
    });

  // ── Add ──

  draft
    .command("add <title> <content>")
    .description(
      "Add a draft. Pass '-' for content to read from stdin. Pass --action up to 3 times to attach AI-suggested actions. Requires a chat session — the agent runtime exports GOBI_SESSION_ID automatically; outside that, pass --session.",
    )
    .option(
      "--session <sessionId>",
      "Originating chat session UUID. Falls back to $GOBI_SESSION_ID when set.",
    )
    .option("--priority <number>", "Priority (lower = higher), default 100")
    .option(
      "--action <label>",
      "Suggested action label (repeatable, max 3). Each label is what the user sees on the button.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .action(
      async (
        title: string,
        content: string,
        opts: {
          session?: string;
          priority?: string;
          action?: string[];
        },
      ) => {
        const sessionId = opts.session || process.env.GOBI_SESSION_ID || "";
        if (!sessionId) {
          console.error(
            "Error: missing session id. Pass --session <uuid> or set GOBI_SESSION_ID in the environment.",
          );
          process.exit(1);
        }
        const body: Record<string, unknown> = {
          title,
          content: readContent(content),
          sessionId,
        };
        if (opts.priority) body.priority = parseInt(opts.priority, 10);
        const actions = parseActionFlags(opts.action);
        if (actions.length) body.actions = actions;

        const resp = (await apiPost("/app/drafts", body)) as Record<string, unknown>;
        const d = unwrapResp(resp) as Draft;

        if (isJsonMode(draft)) {
          jsonOut(d);
          return;
        }

        console.log(
          `Created ${d.draftId} (priority ${d.priority}, ${d.actions.length} action${d.actions.length === 1 ? "" : "s"}).`,
        );
      },
    );

  // ── Delete ──

  draft
    .command("delete <draftId>")
    .description("Delete a draft.")
    .action(async (draftId: string) => {
      await apiDelete(`/app/drafts/${draftId}`);

      if (isJsonMode(draft)) {
        jsonOut({ deleted: draftId });
        return;
      }

      console.log(`Deleted ${draftId}.`);
    });

  // ── Prioritize ──

  draft
    .command("prioritize <draftId> <priority>")
    .description("Set priority (lower = higher). Top 5 feed the system prompt.")
    .action(async (draftId: string, priority: string) => {
      const resp = (await apiPatch(`/app/drafts/${draftId}/priority`, {
        priority: parseInt(priority, 10),
      })) as Record<string, unknown>;
      const d = unwrapResp(resp) as Draft;

      if (isJsonMode(draft)) {
        jsonOut(d);
        return;
      }

      console.log(`Set ${d.draftId} priority to ${d.priority}.`);
    });

  // ── Action ──

  draft
    .command("action <draftId> <actionIndex>")
    .description(
      "Take one of the draft's suggested actions by 0-based index. Marks the draft 'actioned' and the client posts the synthesized message into the originating session.",
    )
    .action(async (draftId: string, actionIndex: string) => {
      const idx = parseInt(actionIndex, 10);
      if (Number.isNaN(idx) || idx < 0 || idx > 2) {
        console.error("Error: actionIndex must be 0, 1, or 2.");
        process.exit(1);
      }
      const resp = (await apiPost(`/app/drafts/${draftId}/action`, {
        actionIndex: idx,
      })) as Record<string, unknown>;
      const d = unwrapResp(resp) as Draft;

      if (isJsonMode(draft)) {
        jsonOut(d);
        return;
      }

      const label = d.actions[idx]?.label ?? `action ${idx}`;
      console.log(`Took action "${label}" on ${d.draftId}.`);
    });

  // ── Revise ──

  draft
    .command("revise <draftId> <comment>")
    .description(
      "Bump the draft to a new revision. Comment is required. Pass --title, --content, and/or --action to update the draft in the same call (--action repeatable, max 3, replaces all). Pass '-' for any of comment/title/content to read from stdin.",
    )
    .option("--title <title>", "Replacement title")
    .option("--content <content>", "Replacement content; pass '-' to read from stdin")
    .option(
      "--action <label>",
      "Replacement suggested action label (repeatable, max 3). When passed, replaces the entire actions array.",
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[],
    )
    .action(
      async (
        draftId: string,
        comment: string,
        opts: {
          title?: string;
          content?: string;
          action?: string[];
        },
      ) => {
        const body: Record<string, unknown> = {
          comment: readContent(comment),
        };
        if (opts.title !== undefined) body.title = opts.title;
        if (opts.content !== undefined) body.content = readContent(opts.content);
        if (opts.action && opts.action.length > 0) {
          body.actions = parseActionFlags(opts.action);
        }

        const resp = (await apiPost(
          `/app/drafts/${draftId}/revise`,
          body,
        )) as Record<string, unknown>;
        const d = unwrapResp(resp) as Draft;

        if (isJsonMode(draft)) {
          jsonOut(d);
          return;
        }

        console.log(`Revised ${d.draftId} → rev${d.revision}.`);
      },
    );
}

import { readFileSync } from "fs";
import { Command } from "commander";
import { apiDelete, apiGet, apiPatch, apiPost } from "../client.js";
import { isJsonMode, jsonOut, unwrapResp } from "./utils.js";

interface ProposalHistoryEvent {
  type: "created" | "revised" | "accepted" | "rejected" | "prioritized";
  revision: number;
  title?: string;
  content?: string;
  comment?: string;
  priority?: number;
  createdAt: string;
}

interface Proposal {
  id: number;
  proposalId: string;
  userId: number;
  sessionId: string;
  revision: number;
  priority: number;
  title: string;
  content: string;
  history: ProposalHistoryEvent[];
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
}

function readContent(value: string): string {
  if (value === "-") return readFileSync("/dev/stdin", "utf8");
  return value;
}

function snippet(content: string, max = 80): string {
  const single = content.replace(/\s+/g, " ");
  return single.length > max ? `${single.slice(0, max)}…` : single;
}

function formatProposalLine(p: Proposal): string {
  const status =
    p.status === "pending" ? "·" : p.status === "accepted" ? "✓" : "✗";
  return `- [${status}] p${p.priority} rev${p.revision} ${p.proposalId.slice(0, 8)}  ${snippet(p.title)}`;
}

export function registerProposalCommand(program: Command): void {
  const proposal = program
    .command("proposal")
    .description(
      "Proposals authored by your agent during chat. Top-5 feed the system prompt; accept/reject/revise update state and the client posts the synthesized message into the session.",
    );

  // ── List ──

  proposal
    .command("list")
    .description("List proposals (priority ASC, then newest first).")
    .option("--limit <number>", "Max proposals to return (1-200)", "50")
    .action(async (opts: { limit: string }) => {
      const params = { limit: parseInt(opts.limit, 10) };
      const resp = (await apiGet("/app/proposals", params)) as Record<string, unknown>;
      const items = ((resp.data as unknown[]) || []) as Proposal[];

      if (isJsonMode(proposal)) {
        jsonOut(items);
        return;
      }

      if (!items.length) {
        console.log("No proposals.");
        return;
      }

      console.log(`Proposals (${items.length}):`);
      for (const p of items) console.log(formatProposalLine(p));
    });

  // ── Get ──

  proposal
    .command("get <proposalId>")
    .description("Show one proposal with its history.")
    .action(async (proposalId: string) => {
      const resp = (await apiGet(`/app/proposals/${proposalId}`)) as Record<string, unknown>;
      const p = unwrapResp(resp) as Proposal;

      if (isJsonMode(proposal)) {
        jsonOut(p);
        return;
      }

      console.log(`Proposal ${p.proposalId}`);
      console.log(`  title:    ${p.title}`);
      console.log(`  status:   ${p.status}`);
      console.log(`  priority: ${p.priority}`);
      console.log(`  revision: ${p.revision}`);
      console.log(`  session:  ${p.sessionId}`);
      console.log(`  created:  ${p.createdAt}`);
      console.log("");
      console.log("Content:");
      console.log(p.content);
      if (p.history.length) {
        console.log("");
        console.log("History:");
        for (const h of p.history) {
          console.log(`  ${h.createdAt}  rev${h.revision}  ${h.type}`);
          if (h.type === "created" || h.type === "revised") {
            if (h.title !== undefined) console.log(`    title:   ${h.title}`);
            if (h.content !== undefined) {
              console.log(`    content: ${snippet(h.content, 200)}`);
            }
            if (h.comment !== undefined) console.log(`    comment: ${h.comment}`);
          } else if (h.type === "prioritized" && h.priority !== undefined) {
            console.log(`    priority=${h.priority}`);
          }
        }
      }
    });

  // ── Add ──

  proposal
    .command("add <title> <content>")
    .description(
      "Add a proposal. Pass '-' for content to read from stdin. Requires a chat session — the agent runtime exports GOBI_SESSION_ID automatically; outside that, pass --session.",
    )
    .option(
      "--session <sessionId>",
      "Originating chat session UUID. Falls back to $GOBI_SESSION_ID when set.",
    )
    .option("--priority <number>", "Priority (lower = higher), default 100")
    .action(
      async (
        title: string,
        content: string,
        opts: { session?: string; priority?: string },
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

        const resp = (await apiPost("/app/proposals", body)) as Record<string, unknown>;
        const p = unwrapResp(resp) as Proposal;

        if (isJsonMode(proposal)) {
          jsonOut(p);
          return;
        }

        console.log(`Created ${p.proposalId} (priority ${p.priority}).`);
      },
    );

  // ── Delete ──

  proposal
    .command("delete <proposalId>")
    .description("Delete a proposal.")
    .action(async (proposalId: string) => {
      await apiDelete(`/app/proposals/${proposalId}`);

      if (isJsonMode(proposal)) {
        jsonOut({ deleted: proposalId });
        return;
      }

      console.log(`Deleted ${proposalId}.`);
    });

  // ── Prioritize ──

  proposal
    .command("prioritize <proposalId> <priority>")
    .description("Set priority (lower = higher). Top 5 feed the system prompt.")
    .action(async (proposalId: string, priority: string) => {
      const resp = (await apiPatch(`/app/proposals/${proposalId}/priority`, {
        priority: parseInt(priority, 10),
      })) as Record<string, unknown>;
      const p = unwrapResp(resp) as Proposal;

      if (isJsonMode(proposal)) {
        jsonOut(p);
        return;
      }

      console.log(`Set ${p.proposalId} priority to ${p.priority}.`);
    });

  // ── Accept ──

  proposal
    .command("accept <proposalId>")
    .description(
      "Mark the proposal accepted. The client posts the synthesized message into the session.",
    )
    .action(async (proposalId: string) => {
      const resp = (await apiPost(`/app/proposals/${proposalId}/accept`)) as Record<string, unknown>;
      const p = unwrapResp(resp) as Proposal;

      if (isJsonMode(proposal)) {
        jsonOut(p);
        return;
      }

      console.log(`Accepted ${p.proposalId}.`);
    });

  // ── Reject ──

  proposal
    .command("reject <proposalId>")
    .description(
      "Mark the proposal rejected. The client posts the synthesized message into the session.",
    )
    .action(async (proposalId: string) => {
      const resp = (await apiPost(`/app/proposals/${proposalId}/reject`)) as Record<string, unknown>;
      const p = unwrapResp(resp) as Proposal;

      if (isJsonMode(proposal)) {
        jsonOut(p);
        return;
      }

      console.log(`Rejected ${p.proposalId}.`);
    });

  // ── Revise ──

  proposal
    .command("revise <proposalId> <comment>")
    .description(
      "Bump the proposal to a new revision. Comment is required; pass --title and/or --content to update the proposal in the same call. Pass '-' for any of comment/title/content to read from stdin.",
    )
    .option("--title <title>", "Replacement title")
    .option("--content <content>", "Replacement content; pass '-' to read from stdin")
    .action(
      async (
        proposalId: string,
        comment: string,
        opts: { title?: string; content?: string },
      ) => {
        const body: Record<string, unknown> = {
          comment: readContent(comment),
        };
        if (opts.title !== undefined) body.title = opts.title;
        if (opts.content !== undefined) body.content = readContent(opts.content);

        const resp = (await apiPost(
          `/app/proposals/${proposalId}/revise`,
          body,
        )) as Record<string, unknown>;
        const p = unwrapResp(resp) as Proposal;

        if (isJsonMode(proposal)) {
          jsonOut(p);
          return;
        }

        console.log(`Revised ${p.proposalId} → rev${p.revision}.`);
      },
    );
}

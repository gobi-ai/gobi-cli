import { readFileSync } from "fs";
import { Command } from "commander";
import { apiDelete, apiGet, apiPatch, apiPost } from "../client.js";
import { isJsonMode, jsonOut, unwrapResp } from "./utils.js";

interface ProposalHistoryEvent {
  type:
    | "created"
    | "edited"
    | "accepted"
    | "rejected"
    | "revise_requested"
    | "prioritized";
  revision: number;
  content?: string;
  comment?: string;
  priority?: number;
  createdAt: string;
}

interface Proposal {
  id: number;
  proposalId: string;
  userId: number;
  sessionId: string | null;
  revision: number;
  priority: number;
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
  return `- [${status}] p${p.priority} rev${p.revision} ${p.proposalId.slice(0, 8)}  ${snippet(p.content)}`;
}

export function registerProposalCommand(program: Command): void {
  const proposal = program
    .command("proposal")
    .description(
      "Proposals authored by your agent during chat. Top-5 feed the system prompt; accept/reject/revise post into the originating chat session.",
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
      console.log(`  status:   ${p.status}`);
      console.log(`  priority: ${p.priority}`);
      console.log(`  revision: ${p.revision}`);
      console.log(`  session:  ${p.sessionId ?? "(none)"}`);
      console.log(`  created:  ${p.createdAt}`);
      console.log("");
      console.log("Content:");
      console.log(p.content);
      if (p.history.length) {
        console.log("");
        console.log("History:");
        for (const h of p.history) {
          const detail =
            h.type === "revise_requested"
              ? `: ${h.comment}`
              : h.type === "prioritized"
                ? `: priority=${h.priority}`
                : "";
          console.log(`  ${h.createdAt}  rev${h.revision}  ${h.type}${detail}`);
        }
      }
    });

  // ── Add ──

  proposal
    .command("add <content>")
    .description("Add a proposal directly. Pass '-' to read from stdin.")
    .option("--session <sessionId>", "Originate from a chat session (UUID)")
    .option("--priority <number>", "Priority (lower = higher), default 100")
    .action(
      async (
        content: string,
        opts: { session?: string; priority?: string },
      ) => {
        const body: Record<string, unknown> = { content: readContent(content) };
        if (opts.session) body.sessionId = opts.session;
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

  // ── Edit content ──

  proposal
    .command("edit <proposalId> <content>")
    .description("Replace proposal content (bumps revision). Pass '-' for stdin.")
    .action(async (proposalId: string, content: string) => {
      const resp = (await apiPatch(`/app/proposals/${proposalId}`, {
        content: readContent(content),
      })) as Record<string, unknown>;
      const p = unwrapResp(resp) as Proposal;

      if (isJsonMode(proposal)) {
        jsonOut(p);
        return;
      }

      console.log(`Updated ${p.proposalId} → rev${p.revision}.`);
    });

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
      'Accept — posts "Accept your proposal X" into the originating chat session.',
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
      'Reject — posts "Reject your proposal X" into the originating chat session.',
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
      'Ask the agent to revise — posts "Update your proposal X. Here\'s my comment. {comment}" into the chat session.',
    )
    .action(async (proposalId: string, comment: string) => {
      const resp = (await apiPost(`/app/proposals/${proposalId}/revise`, {
        comment: readContent(comment),
      })) as Record<string, unknown>;
      const p = unwrapResp(resp) as Proposal;

      if (isJsonMode(proposal)) {
        jsonOut(p);
        return;
      }

      console.log(`Revision requested on ${p.proposalId}.`);
    });
}

/**
 * Write confirmation: MCP elicitation when the client supports it, otherwise
 * a two-step confirmToken the model must echo after the user agrees.
 */

import { acceptedContent, inputRequired, type ServerContext } from "@modelcontextprotocol/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { fail, ok } from "./result.js";

export const confirmSchema = z.object({
  confirm: z.boolean().describe("True to proceed with this write. False to cancel."),
});

export interface PendingWrite {
  token: string;
  action: string;
  payloadKey: string;
  preview: string;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000;
const pending = new Map<string, PendingWrite>();

export function payloadKey(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = payload[k];
  return JSON.stringify(ordered);
}

export function mintConfirmToken(action: string, payload: Record<string, unknown>, preview: string): string {
  const token = `gobi_cf_${randomBytes(18).toString("base64url")}`;
  pending.set(token, {
    token,
    action,
    payloadKey: payloadKey(payload),
    preview,
    expiresAt: Date.now() + TTL_MS,
  });
  return token;
}

export function takeConfirmToken(
  token: string,
  action: string,
  payload: Record<string, unknown>,
): PendingWrite | null {
  const p = pending.get(token);
  pending.delete(token);
  if (!p || p.expiresAt < Date.now()) return null;
  if (p.action !== action || p.payloadKey !== payloadKey(payload)) return null;
  return p;
}

export function peekConfirmToken(token: string): PendingWrite | undefined {
  return pending.get(token);
}

export function resetConfirmStore(): void {
  pending.clear();
}

export type ConfirmGate =
  | { kind: "proceed" }
  | { kind: "stop"; result: ReturnType<typeof ok> | ReturnType<typeof fail> | ReturnType<typeof inputRequired> };

/**
 * Gate a write. Callers execute the mutation only on `{ kind: "proceed" }`.
 *
 * Order: elicitation accept on retry → matching confirmToken → ask
 * (2026 `inputRequired` elicit, else 2025 `elicitInput`, else two-step token).
 */
export async function requireWriteConfirmation(
  ctx: ServerContext,
  opts: {
    action: string;
    payload: Record<string, unknown>;
    preview: string;
    confirmToken?: string;
  },
): Promise<ConfirmGate> {
  const elicited = acceptedContent(ctx.mcpReq.inputResponses, "confirm", confirmSchema);
  if (elicited?.confirm === true) return { kind: "proceed" };
  if (elicited?.confirm === false) {
    return { kind: "stop", result: fail(new Error("Write cancelled: the user declined.")) };
  }

  if (opts.confirmToken) {
    const taken = takeConfirmToken(opts.confirmToken, opts.action, opts.payload);
    if (!taken) {
      return {
        kind: "stop",
        result: fail(
          new Error(
            "Invalid or expired confirmToken. Call this tool again without confirmToken to start a new confirmation.",
          ),
        ),
      };
    }
    return { kind: "proceed" };
  }

  const token = mintConfirmToken(opts.action, opts.payload, opts.preview);
  const modern = Boolean(ctx.mcpReq.envelope);

  if (modern) {
    return {
      kind: "stop",
      result: inputRequired({
        requestState: token,
        inputRequests: {
          confirm: inputRequired.elicit({
            message: `${opts.preview}\n\nConfirm this write? You may also retry the tool with confirmToken=${token}.`,
            requestedSchema: confirmSchema,
          }),
        },
      }),
    };
  }

  try {
    const push = await ctx.mcpReq.elicitInput({
      mode: "form",
      message: opts.preview,
      requestedSchema: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "True to proceed with this write" },
        },
        required: ["confirm"],
      },
    });
    if (push.action === "accept" && push.content && (push.content as { confirm?: boolean }).confirm === true) {
      takeConfirmToken(token, opts.action, opts.payload);
      return { kind: "proceed" };
    }
    return { kind: "stop", result: fail(new Error("Write cancelled: the user declined.")) };
  } catch {
    // Client has no elicitation handler (or rejected the server→client request).
  }

  return {
    kind: "stop",
    result: ok({
      needsConfirmation: true,
      confirmToken: token,
      preview: opts.preview,
      action: opts.action,
      expiresInSeconds: Math.floor(TTL_MS / 1000),
      instruction:
        "Show the preview to the user. If they confirm, call this tool again with the same arguments plus confirmToken. Do not invent a token.",
    }),
  };
}

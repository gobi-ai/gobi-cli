import { GobiError } from "./gobi-client.js";

export function ok(data: object) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

export function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof GobiError ? err.code : undefined;
  const text = code ? `${code}: ${message}` : message;
  return {
    content: [{ type: "text" as const, text }],
    isError: true as const,
  };
}

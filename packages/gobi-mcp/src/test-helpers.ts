import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { createGobiApi, type GobiApi } from "./gobi-client.js";

/** Serve a Fetch handler on an ephemeral 127.0.0.1 port (OAuth + MCP e2e). */
export async function listenFetchHandler(
  handler: (req: Request) => Promise<Response>,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    void dispatchFetch(handler, req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function dispatchFetch(
  handler: (req: Request) => Promise<Response>,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const url = `http://${req.headers.host ?? "127.0.0.1"}${req.url ?? "/"}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue;
      headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    }
    const method = req.method ?? "GET";
    const hasBody = method !== "GET" && method !== "HEAD";
    const init: RequestInit & { duplex?: "half" } = { method, headers };
    if (hasBody) {
      init.body = Readable.toWeb(req) as ReadableStream;
      init.duplex = "half";
    }
    const response = await handler(new Request(url, init));
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    if (!response.body) {
      res.end();
      return;
    }
    const nodeStream = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
    nodeStream.pipe(res);
  } catch (err) {
    if (!res.headersSent) res.statusCode = 500;
    res.end(err instanceof Error ? err.message : String(err));
  }
}

export interface MockRoute {
  method?: string;
  path: string | RegExp;
  status?: number;
  body?: unknown;
  text?: string;
}

export function mockApi(routes: MockRoute[], opts?: { baseUrl?: string }): {
  api: GobiApi;
  calls: { method: string; url: string }[];
} {
  const calls: { method: string; url: string }[] = [];
  const baseUrl = opts?.baseUrl ?? "http://gobi.test";

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ method, url });
    const parsed = new URL(url);
    const pathAndQuery = parsed.pathname + parsed.search;
    const matches = routes.filter((r) => {
      if ((r.method ?? "GET").toUpperCase() !== method) return false;
      if (typeof r.path !== "string") return r.path.test(parsed.pathname);
      return parsed.pathname === r.path;
    });
    matches.sort((a, b) => {
      const al = typeof a.path === "string" ? a.path.length : 0;
      const bl = typeof b.path === "string" ? b.path.length : 0;
      return bl - al;
    });
    const hit = matches[0];
    if (!hit) {
      return new Response(JSON.stringify({ message: `not mocked: ${method} ${pathAndQuery}` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (hit.text != null) {
      return new Response(hit.text, { status: hit.status ?? 200 });
    }
    return new Response(JSON.stringify(hit.body ?? {}), {
      status: hit.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const api = createGobiApi({
    getToken: async () => "test-token",
    fetch: fetchImpl,
    baseUrl,
  });
  return { api, calls };
}

export function fixtureContextRoutes(now = Date.now()): MockRoute[] {
  const recent = new Date(now - 2 * 3600_000).toISOString();
  const older = new Date(now - 48 * 3600_000).toISOString();
  return [
    {
      path: "/app/activities",
      body: {
        activities: [
          {
            publicId: "v0123456789",
            category: "working",
            details: "writing code",
            start_time: recent,
            end_time: null,
          },
          {
            publicId: "vaaaaaaaaaa",
            category: "commuting",
            details: "train home",
            start_time: older,
            end_time: older,
          },
        ],
        pagination: { hasMore: false },
      },
    },
    {
      path: "/app/activity/v0123456789",
      body: {
        publicId: "v0123456789",
        category: "working",
        details: "writing code",
        start_time: recent,
        end_time: null,
      },
    },
    {
      path: "/app/conversations/o0123456789/transcript",
      body: {
        publicId: "o0123456789",
        title: "Standup",
        source: "mobile",
        startTime: recent,
        summary: "---\ntitle: Standup\n---\nAgreed to send the deck.",
        sideNotes: null,
        turns: [
          { speaker: "spk_0", speakerLabel: "Me", text: "hi", timestamp: "0:00" },
          { speaker: "spk_1", speakerLabel: "Min", text: "hey", timestamp: "0:02" },
        ],
      },
    },
    {
      path: "/app/conversations",
      body: {
        conversations: [
          {
            publicId: "o0123456789",
            title: "Standup",
            source: "mobile",
            startTime: recent,
          },
          {
            publicId: "obbbbbbbbbb",
            title: "Yesterday",
            source: "text",
            startTime: older,
          },
        ],
        pagination: { hasMore: false },
      },
    },
    {
      path: "/notifications",
      body: {
        data: [
          {
            id: "n0123456789",
            type: "capture_note",
            title: "Note ready",
            body: "Standup summary landed",
            data: { conversationPublicId: "o0123456789" },
            read: false,
            createdAt: recent,
          },
          {
            id: "ncccccccccc",
            type: "user_mention",
            title: "You were mentioned",
            body: "not a capture",
            data: null,
            read: false,
            createdAt: recent,
          },
          {
            id: "ndddddddddd",
            type: "capture_activity",
            title: "Old activity",
            body: "from yesterday",
            data: null,
            read: true,
            createdAt: older,
          },
        ],
        pagination: { hasMore: false },
      },
    },
    {
      path: "/auth/me",
      body: {
        publicId: "u0123456789",
        name: "Ada",
        email: "ada@example.com",
        pictureUrl: null,
      },
    },
  ];
}

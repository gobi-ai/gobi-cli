import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fixtureContextRoutes, type MockRoute } from "./test-helpers.js";

export function fixtureDirectoryRoutes(): MockRoute[] {
  return [
    {
      path: "/app/people/person_min",
      body: {
        publicId: "person_min",
        name: "Min",
        role: "teammate",
        highlights: ["standup deck"],
      },
    },
    {
      path: "/app/people",
      body: {
        people: [
          {
            publicId: "person_min",
            name: "Min",
            role: "teammate",
            highlights: ["standup deck"],
          },
        ],
      },
    },
    {
      path: "/app/conversations/search",
      body: {
        conversations: [
          {
            publicId: "o0123456789",
            title: "Standup",
            source: "mobile",
            startTime: new Date().toISOString(),
            summary: "Agreed to send the deck.",
            speakers: ["Me", "Min"],
          },
        ],
        pagination: { hasMore: false },
      },
    },
    {
      method: "POST",
      path: "/auth/connect-token/exchange",
      body: { accessToken: "exchanged-access", user: { name: "Ada", email: "ada@example.com" } },
    },
    {
      method: "POST",
      path: "/auth/workos/exchange",
      body: { accessToken: "gobi-from-workos" },
    },
  ];
}

export async function startMockGobiBackend(extra: MockRoute[] = []): Promise<{
  url: string;
  close: () => Promise<void>;
  server: Server;
}> {
  const routes = [...fixtureDirectoryRoutes(), ...fixtureContextRoutes(), ...extra];
  const server = createServer((req, res) => {
    const host = req.headers.host ?? "127.0.0.1";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const method = (req.method ?? "GET").toUpperCase();
    const matches = routes.filter((r) => {
      if ((r.method ?? "GET").toUpperCase() !== method) return false;
      if (typeof r.path !== "string") return r.path.test(url.pathname);
      return url.pathname === r.path;
    });
    matches.sort((a, b) => {
      const al = typeof a.path === "string" ? a.path.length : 0;
      const bl = typeof b.path === "string" ? b.path.length : 0;
      return bl - al;
    });
    const hit = matches[0];
    if (!hit) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ message: `not mocked: ${method} ${url.pathname}` }));
      return;
    }
    res.statusCode = hit.status ?? 200;
    res.setHeader("Content-Type", "application/json");
    res.end(hit.text ?? JSON.stringify(hit.body ?? {}));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    server,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

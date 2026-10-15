import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createGobiMcpServer } from "./server.js";
import { TOOL_NAMES } from "./tools.js";
import { PROMPT_NAMES } from "./prompts.js";
import { DAILY_SNAPSHOT_URI } from "./resources.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { InMemoryNoteSearch, InMemoryPeopleDirectory } from "./directory.js";
import { fixtureContextRoutes, mockApi } from "./test-helpers.js";

const samplePeople = new InMemoryPeopleDirectory([
  { id: "person_min", name: "Min", role: "teammate", highlights: ["standup deck"] },
]);
const sampleSearch = new InMemoryNoteSearch([
  {
    id: "o0123456789",
    title: "Standup",
    time: "2026-10-14T18:00:00.000Z",
    summary: "Agreed to send the deck.",
    speakers: ["Me", "Min"],
    source: "mobile",
    sourceLabel: "audio log",
  },
]);

async function connect(api: ReturnType<typeof mockApi>["api"]) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createGobiMcpServer(api, { people: samplePeople, noteSearch: sampleSearch });
  const client = new Client({ name: "test", version: "0.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

describe("Gobi MCP server (mocked API)", () => {
  it("advertises only the read-only gobi_ tools", async () => {
    const { api } = mockApi(fixtureContextRoutes());
    const { client, server } = await connect(api);
    try {
      const listed = await client.listTools();
      const names = listed.tools.map((t) => t.name).sort();
      assert.deepEqual(names, [...TOOL_NAMES].sort());
      assert.equal(listed.tools.length, TOOL_NAMES.length);
      for (const t of listed.tools) {
        assert.match(t.name, /^gobi_/);
        assert.doesNotMatch(t.name, /post|space|create|delete|edit/);
      }
      const contextTool = listed.tools.find((t) => t.name === "gobi_get_personal_context");
      assert.ok(contextTool?.description);
      assert.match(contextTool.description, /what am I doing now/);
      assert.match(contextTool.description, /지금 뭐 해\?/);
      assert.match(contextTool.description, /who did I just meet/);
      assert.match(contextTool.description, /BEFORE calendar/);
      const instructions = client.getInstructions();
      if (typeof instructions === "string") {
        assert.match(instructions, /Interruptibility gate/);
        assert.match(instructions, /도와줄까\?/);
      }
      for (const tool of listed.tools) {
        assert.equal(tool.annotations?.readOnlyHint, true);
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("server instructions carry Gobi-first, interruptibility, and offer-help", () => {
    assert.match(SERVER_INSTRUCTIONS, /Gobi first/);
    assert.match(SERVER_INSTRUCTIONS, /what am I doing now/);
    assert.match(SERVER_INSTRUCTIONS, /지금 뭐 해\?/);
    assert.match(SERVER_INSTRUCTIONS, /who did I just meet/);
    assert.match(SERVER_INSTRUCTIONS, /before calendar/i);
    assert.match(SERVER_INSTRUCTIONS, /Interruptibility gate/);
    assert.match(SERVER_INSTRUCTIONS, /driving/);
    assert.match(SERVER_INSTRUCTIONS, /exercise/);
    assert.match(SERVER_INSTRUCTIONS, /sleeping/);
    assert.match(SERVER_INSTRUCTIONS, /도와줄까\?/);
    assert.match(SERVER_INSTRUCTIONS, /1–3/);
  });

  it("gobi_get_personal_context returns the composed snapshot", async () => {
    const { api } = mockApi(fixtureContextRoutes());
    const { client, server } = await connect(api);
    try {
      const result = await client.callTool({
        name: "gobi_get_personal_context",
        arguments: { since: "24h", limit: 5 },
      });
      assert.equal(result.isError, undefined);
      const data = result.structuredContent as {
        currentActivity: { id: string };
        notes: { speakers: string[] }[];
        captures: unknown[];
      };
      assert.equal(data.currentActivity.id, "v0123456789");
      assert.deepEqual(data.notes[0]?.speakers, ["Me", "Min"]);
      assert.equal(data.captures.length, 1);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("gobi_whoami and gobi_get_note work", async () => {
    const { api } = mockApi(fixtureContextRoutes());
    const { client, server } = await connect(api);
    try {
      const who = await client.callTool({ name: "gobi_whoami", arguments: {} });
      assert.equal((who.structuredContent as { user: { name: string } }).user.name, "Ada");

      const note = await client.callTool({
        name: "gobi_get_note",
        arguments: { noteId: "o0123456789" },
      });
      const body = note.structuredContent as { summary: string; speakers: string[] };
      assert.equal(body.summary, "Agreed to send the deck.");
      assert.deepEqual(body.speakers, ["Me", "Min"]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("reads gobi://personal/daily-snapshot", async () => {
    const { api } = mockApi(fixtureContextRoutes());
    const { client, server } = await connect(api);
    try {
      const res = await client.readResource({ uri: DAILY_SNAPSHOT_URI });
      const text = res.contents[0] && "text" in res.contents[0] ? res.contents[0].text : "";
      const parsed = JSON.parse(String(text)) as { currentActivity: { id: string } };
      assert.equal(parsed.currentActivity.id, "v0123456789");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("lists catch-up, evening-debrief, and people-met-today prompts", async () => {
    const { api } = mockApi(fixtureContextRoutes());
    const { client, server } = await connect(api);
    try {
      const listed = await client.listPrompts();
      const names = listed.prompts.map((p) => p.name).sort();
      assert.deepEqual(names, [...PROMPT_NAMES].sort());

      const catchUp = await client.getPrompt({ name: "catch-up" });
      const text = catchUp.messages[0]?.content;
      assert.equal(text && "text" in text ? text.type : "", "text");
      if (text && "text" in text) {
        assert.match(text.text, /gobi_get_personal_context/);
        assert.match(text.text, /도와줄까\?/);
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("rejects an invalid note id as a tool error", async () => {
    const { api } = mockApi(fixtureContextRoutes());
    const { client, server } = await connect(api);
    try {
      const result = await client.callTool({
        name: "gobi_get_note",
        arguments: { noteId: "not-a-note" },
      });
      assert.equal(result.isError, true);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("gobi_list_people, gobi_get_person, and gobi_search_notes return directory fixtures", async () => {
    const { api } = mockApi(fixtureContextRoutes());
    const { client, server } = await connect(api);
    try {
      const listed = await client.callTool({ name: "gobi_list_people", arguments: { q: "Min" } });
      assert.equal(listed.isError, undefined);
      const people = listed.structuredContent as { people: { id: string; name: string }[] };
      assert.equal(people.people[0]?.id, "person_min");
      assert.equal(people.people[0]?.name, "Min");

      const one = await client.callTool({ name: "gobi_get_person", arguments: { personId: "person_min" } });
      assert.equal((one.structuredContent as { person: { name: string } }).person.name, "Min");

      const search = await client.callTool({ name: "gobi_search_notes", arguments: { q: "deck" } });
      const notes = search.structuredContent as { notes: { id: string; title: string | null }[] };
      assert.equal(notes.notes[0]?.id, "o0123456789");
      assert.equal(notes.notes[0]?.title, "Standup");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("directory tools return unimplemented when People DB / notes search are missing", async () => {
    const { api } = mockApi(fixtureContextRoutes());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createGobiMcpServer(api);
    const client = new Client({ name: "test", version: "0.0.0" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const listed = await client.callTool({ name: "gobi_list_people", arguments: {} });
      const body = listed.structuredContent as { unimplemented?: boolean; endpoint?: string };
      assert.equal(body.unimplemented, true);
      assert.match(String(body.endpoint), /\/app\/people/);

      const search = await client.callTool({ name: "gobi_search_notes", arguments: { q: "deck" } });
      const notes = search.structuredContent as { unimplemented?: boolean; endpoint?: string };
      assert.equal(notes.unimplemented, true);
      assert.match(String(notes.endpoint), /conversations\/search/);
    } finally {
      await client.close();
      await server.close();
    }
  });
});

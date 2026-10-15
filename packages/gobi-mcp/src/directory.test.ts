import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HttpNoteSearch,
  HttpPeopleDirectory,
  InMemoryNoteSearch,
  InMemoryPeopleDirectory,
  isUnimplemented,
} from "./directory.js";
import { mockApi } from "./test-helpers.js";

describe("People + notes search", () => {
  it("in-memory directory filters by query", async () => {
    const dir = new InMemoryPeopleDirectory([
      { id: "person_min", name: "Min", role: "teammate", highlights: ["deck"] },
      { id: "person_sam", name: "Sam", role: "coach", highlights: [] },
    ]);
    const all = await dir.listPeople();
    assert.ok(!isUnimplemented(all) && all.people.length === 2);
    const q = await dir.listPeople({ q: "min" });
    assert.ok(!isUnimplemented(q) && q.people[0]?.id === "person_min");
    const one = await dir.getPerson("person_min");
    assert.ok(!isUnimplemented(one) && one.person.name === "Min");
  });

  it("HTTP adapters surface unimplemented on 404", async () => {
    const { api } = mockApi([]);
    const people = new HttpPeopleDirectory(api);
    const search = new HttpNoteSearch(api);
    const listed = await people.listPeople();
    assert.ok(isUnimplemented(listed));
    assert.match(listed.endpoint, /\/app\/people/);
    const notes = await search.searchNotes({ query: "deck" });
    assert.ok(isUnimplemented(notes));
    assert.match(notes.endpoint, /conversations\/search/);
  });

  it("HTTP adapters parse backend payloads when present", async () => {
    const { api } = mockApi([
      {
        path: "/app/people",
        body: { people: [{ publicId: "person_min", name: "Min", role: "teammate", highlights: ["hi"] }] },
      },
      {
        path: "/app/conversations/search",
        body: { conversations: [{ publicId: "o0123456789", title: "Standup", source: "mobile" }] },
      },
    ]);
    const listed = await new HttpPeopleDirectory(api).listPeople();
    assert.ok(!isUnimplemented(listed));
    assert.equal(listed.people[0]?.name, "Min");
    const hits = await new HttpNoteSearch(api).searchNotes({ query: "Standup" });
    assert.ok(!isUnimplemented(hits));
    assert.equal(hits.notes[0]?.id, "o0123456789");
  });
});

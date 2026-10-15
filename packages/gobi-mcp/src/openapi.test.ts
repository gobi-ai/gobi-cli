import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG } from "./catalog.js";
import { buildOpenApiSpec, openApiJson } from "./openapi.js";
import { TOOL_NAMES } from "./tools.js";

describe("OpenAPI catalog", () => {
  it("covers every phase-2 MCP tool", () => {
    const tools = CATALOG.filter((o) => o.phase <= 2).map((o) => o.tool).sort();
    assert.deepEqual(tools, [...TOOL_NAMES].sort());
  });

  it("emits OpenAPI 3.1 with bearer auth and operationIds", () => {
    const spec = buildOpenApiSpec();
    assert.equal(spec.openapi, "3.1.0");
    const paths = spec.paths as Record<string, Record<string, { operationId: string }>>;
    assert.equal(paths["/v1/personal/context"]?.get?.operationId, "gobi_get_personal_context");
    assert.equal(paths["/v1/people"]?.get?.operationId, "gobi_list_people");
    assert.equal(paths["/v1/personal/notes/search"]?.get?.operationId, "gobi_search_notes");
  });

  it("committed openapi.json matches the catalog", () => {
    const committed = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "openapi.json"), "utf8");
    assert.equal(committed, openApiJson());
  });
});

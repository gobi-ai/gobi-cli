import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG } from "./catalog.js";
import { buildOpenApiSpec, openApiJson } from "./openapi.js";
import { advertisedToolNames, SPACE_TOOL_NAMES, WRITE_TOOL_NAMES } from "./tools.js";

describe("OpenAPI catalog", () => {
  it("covers every default MCP tool plus opt-in space/write ops", () => {
    const tools = CATALOG.map((o) => o.tool).sort();
    const expected = [...advertisedToolNames({ enableSpaceTools: true })].sort();
    assert.deepEqual(tools, expected);
    assert.ok(WRITE_TOOL_NAMES.every((n) => tools.includes(n)));
    assert.ok(SPACE_TOOL_NAMES.every((n) => tools.includes(n)));
  });

  it("emits OpenAPI 3.1 with bearer auth and operationIds", () => {
    const spec = buildOpenApiSpec();
    assert.equal(spec.openapi, "3.1.0");
    const paths = spec.paths as Record<string, Record<string, { operationId: string }>>;
    assert.equal(paths["/v1/personal/context"]?.get?.operationId, "gobi_get_personal_context");
    assert.equal(paths["/v1/people"]?.get?.operationId, "gobi_list_people");
    assert.equal(paths["/v1/personal/notes/search"]?.get?.operationId, "gobi_search_notes");
    const searchParams = (
      paths["/v1/personal/notes/search"]?.get as { parameters?: { name: string; required?: boolean }[] }
    ).parameters;
    const queryParam = searchParams?.find((p) => p.name === "query");
    const qAlias = searchParams?.find((p) => p.name === "q");
    assert.equal(queryParam?.required, true);
    assert.equal(qAlias?.required, false);
    assert.equal(paths["/v1/personal/posts/{postId}/replies"]?.post?.operationId, "gobi_reply_to_post");
    assert.equal(paths["/v1/spaces/{spaceSlug}/posts"]?.get?.operationId, "gobi_list_space_posts");
  });

  it("committed openapi.json matches the catalog", () => {
    const committed = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "openapi.json"), "utf8");
    assert.equal(committed, openApiJson());
  });
});

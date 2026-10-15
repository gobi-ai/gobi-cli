/**
 * Write packages/gobi-mcp/openapi.json from the MCP↔REST catalog.
 * Run: npm run generate-openapi
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openApiJson } from "../src/openapi.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
writeFileSync(join(root, "openapi.json"), openApiJson());
console.log("wrote openapi.json");

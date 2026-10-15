import { z } from "zod";
import { CATALOG, type CatalogOp } from "./catalog.js";
import { mcpPublicUrl } from "./oauth/types.js";
import { packageVersion } from "./version.js";

function schemaToJson(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema) as Record<string, unknown>;
  delete raw.$schema;
  return raw;
}

function pathParams(path: string): string[] {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!);
}

function operation(op: CatalogOp): Record<string, unknown> {
  const params = pathParams(op.path);
  const inputJson = schemaToJson(op.input);
  const properties = (inputJson.properties as Record<string, unknown> | undefined) ?? {};
  const required = (inputJson.required as string[] | undefined) ?? [];

  const parameters: unknown[] = [];
  for (const name of params) {
    parameters.push({
      name,
      in: "path",
      required: true,
      schema: properties[name] ?? { type: "string" },
    });
  }
  if (op.method === "get") {
    for (const [name, schema] of Object.entries(properties)) {
      if (params.includes(name)) continue;
      parameters.push({
        name,
        in: "query",
        required: required.includes(name),
        schema,
      });
    }
  }

  const body =
    op.method === "post"
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: inputJson } },
          },
        }
      : {};

  return {
    operationId: op.tool,
    summary: op.title,
    description: op.description,
    tags: [op.space ? "space" : op.write ? "write" : "personal"],
    security: [{ bearerAuth: [] }],
    parameters,
    ...body,
    responses: {
      "200": {
        description: "OK",
        content: { "application/json": { schema: schemaToJson(op.output) } },
      },
      "401": { description: "Missing or invalid bearer token" },
    },
  };
}

export function buildOpenApiSpec(opts?: { ops?: CatalogOp[] }): Record<string, unknown> {
  const ops = opts?.ops ?? CATALOG.filter((o) => o.phase <= 2);
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of ops) {
    paths[op.path] ??= {};
    paths[op.path]![op.method] = operation(op);
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Gobi MCP HTTP API",
      version: packageVersion(),
      description:
        "REST mapping of the Gobi MCP tools for agents that cannot speak MCP. Same core as the MCP server. Authenticate with Authorization: Bearer (OAuth 2.1 access token or gbi_ / Gobi access token). Generated from src/catalog.ts.",
    },
    servers: [{ url: mcpPublicUrl(), description: "Hosted MCP origin" }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "OAuth2 / gbi_" },
      },
    },
  };
}

export function openApiJson(opts?: { ops?: CatalogOp[] }): string {
  return JSON.stringify(buildOpenApiSpec(opts), null, 2) + "\n";
}

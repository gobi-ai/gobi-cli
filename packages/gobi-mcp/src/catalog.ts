/**
 * Single catalog of MCP tools ↔ REST operations. OpenAPI is generated from this.
 */

import type { z } from "zod";
import {
  activityGetSchema,
  activityIdInput,
  activityListSchema,
  captureListSchema,
  capturesInput,
  currentActivitySchema,
  emptyInput,
  listInput,
  listPeopleInput,
  noteDetailSchema,
  noteIdInput,
  noteListSchema,
  noteSearchOutSchema,
  peopleListSchema,
  personGetSchema,
  personIdInput,
  personalContextSchema,
  searchNotesInput,
  sinceLimitInput,
  whoamiSchema,
} from "./schemas.js";

export type HttpMethod = "get" | "post";

export interface CatalogOp {
  tool: string;
  title: string;
  description: string;
  method: HttpMethod;
  path: string;
  input: z.ZodType;
  output: z.ZodType;
  phase: 1 | 2 | 3;
  write?: boolean;
  space?: boolean;
}

export const CATALOG: CatalogOp[] = [
  {
    tool: "gobi_get_personal_context",
    title: "Get personal context",
    description: "Current activity, recent activities, notes, captures.",
    method: "get",
    path: "/v1/personal/context",
    input: sinceLimitInput,
    output: personalContextSchema,
    phase: 1,
  },
  {
    tool: "gobi_get_current_activity",
    title: "Get current activity",
    description: "Latest / ongoing personal activity.",
    method: "get",
    path: "/v1/personal/activity/current",
    input: emptyInput,
    output: currentActivitySchema,
    phase: 1,
  },
  {
    tool: "gobi_list_activities",
    title: "List activities",
    description: "Personal activities, newest first.",
    method: "get",
    path: "/v1/personal/activities",
    input: listInput,
    output: activityListSchema,
    phase: 1,
  },
  {
    tool: "gobi_get_activity",
    title: "Get activity",
    description: "One activity by id (v…).",
    method: "get",
    path: "/v1/personal/activities/{activityId}",
    input: activityIdInput,
    output: activityGetSchema,
    phase: 1,
  },
  {
    tool: "gobi_list_notes",
    title: "List notes",
    description: "Personal notes, newest first.",
    method: "get",
    path: "/v1/personal/notes",
    input: listInput,
    output: noteListSchema,
    phase: 1,
  },
  {
    tool: "gobi_get_note",
    title: "Get note",
    description: "One note by id (o…).",
    method: "get",
    path: "/v1/personal/notes/{noteId}",
    input: noteIdInput,
    output: noteDetailSchema,
    phase: 1,
  },
  {
    tool: "gobi_list_captures",
    title: "List captures",
    description: "Fresh Sense capture notifications.",
    method: "get",
    path: "/v1/personal/captures",
    input: capturesInput,
    output: captureListSchema,
    phase: 1,
  },
  {
    tool: "gobi_whoami",
    title: "Who am I",
    description: "Authenticated Gobi identity.",
    method: "get",
    path: "/v1/whoami",
    input: emptyInput,
    output: whoamiSchema,
    phase: 1,
  },
  {
    tool: "gobi_search_notes",
    title: "Search notes",
    description: "Search personal Sense notes. Backend GET /app/conversations/search (TODO if 404).",
    method: "get",
    path: "/v1/personal/notes/search",
    input: searchNotesInput,
    output: noteSearchOutSchema,
    phase: 2,
  },
  {
    tool: "gobi_list_people",
    title: "List people",
    description: "People directory. Backend GET /app/people (Jimin / TODO if 404).",
    method: "get",
    path: "/v1/people",
    input: listPeopleInput,
    output: peopleListSchema,
    phase: 2,
  },
  {
    tool: "gobi_get_person",
    title: "Get person",
    description: "One person from the People DB. Backend GET /app/people/:id.",
    method: "get",
    path: "/v1/people/{personId}",
    input: personIdInput,
    output: personGetSchema,
    phase: 2,
  },
];

export function catalogForPhase(maxPhase: 1 | 2 | 3, opts?: { space?: boolean; writes?: boolean }): CatalogOp[] {
  return CATALOG.filter((op) => {
    if (op.phase > maxPhase) return false;
    if (op.space && !opts?.space) return false;
    if (op.write && !opts?.writes) return false;
    return true;
  });
}

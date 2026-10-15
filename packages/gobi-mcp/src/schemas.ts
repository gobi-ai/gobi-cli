import { z } from "zod";

export const activitySchema = z.object({
  id: z.string(),
  category: z.string().nullable(),
  details: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
});

export const noteSummarySchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  time: z.string().nullable(),
  summary: z.string().nullable(),
  speakers: z.array(z.string()),
  source: z.string().nullable(),
  sourceLabel: z.string(),
});

export const captureSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  read: z.boolean(),
});

export const contextErrorSchema = z.object({
  section: z.enum(["currentActivity", "activities", "notes", "captures"]),
  error: z.string(),
});

export const personalContextSchema = z.object({
  since: z.string(),
  currentActivity: activitySchema.nullable(),
  activities: z.array(activitySchema),
  notes: z.array(noteSummarySchema),
  captures: z.array(captureSchema),
  errors: z.array(contextErrorSchema),
});

export const turnSchema = z.object({
  speaker: z.string(),
  speakerLabel: z.string().optional(),
  timestamp: z.string(),
  endTimestamp: z.string().optional(),
  text: z.string(),
});

export const noteDetailSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  time: z.string().nullable(),
  summary: z.string().nullable(),
  speakers: z.array(z.string()),
  source: z.string().nullable(),
  sourceLabel: z.string(),
  sideNotes: z.string().nullable(),
  status: z.string().nullable(),
  ongoing: z.boolean(),
  turns: z.array(turnSchema),
});

export const paginationSchema = z.object({
  hasMore: z.boolean().optional(),
  nextCursor: z.string().optional(),
});

export const activityListSchema = z.object({
  activities: z.array(activitySchema),
  pagination: paginationSchema,
});

export const noteListSchema = z.object({
  notes: z.array(noteSummarySchema),
  pagination: paginationSchema,
});

export const captureListSchema = z.object({
  captures: z.array(captureSchema),
  hasMore: z.boolean(),
});

export const currentActivitySchema = z.object({
  currentActivity: activitySchema.nullable(),
});

export const activityGetSchema = z.object({
  activity: activitySchema,
});

export const whoamiSchema = z.object({
  authenticated: z.boolean(),
  user: z.unknown().nullable(),
});

export const sinceLimitInput = z.object({
  since: z
    .string()
    .optional()
    .describe("Window start: duration (24h, 7d, 30m) or ISO timestamp. Default 24h."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Max items per section (default 5, max 50)."),
});

export const listInput = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Max items to return (default 30, max 100)."),
  before: z
    .string()
    .optional()
    .describe("Pagination cursor (nextCursor) from a previous list call."),
});

export const capturesInput = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Max capture notifications to return (default 30, max 100)."),
});

export const noteIdInput = z.object({
  noteId: z.string().describe("Note public id (o…)."),
});

export const activityIdInput = z.object({
  activityId: z.string().describe("Activity public id (v…)."),
});

export const emptyInput = z.object({});

export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().nullable(),
  highlights: z.array(z.string()),
  aliases: z.array(z.string()).optional(),
});

export const unimplementedSchema = z.object({
  unimplemented: z.literal(true),
  endpoint: z.string(),
  todo: z.string(),
});

export const peopleListSchema = z.union([
  z.object({ people: z.array(personSchema) }),
  unimplementedSchema,
]);

export const personGetSchema = z.union([
  z.object({ person: personSchema }),
  unimplementedSchema,
]);

export const noteSearchHitSchema = noteSummarySchema;

export const noteSearchOutSchema = z.union([
  z.object({
    notes: z.array(noteSearchHitSchema),
    pagination: paginationSchema.optional(),
  }),
  unimplementedSchema,
]);

export const searchNotesInput = z.object({
  q: z.string().min(1).describe("Search query over note titles, summaries, and speakers."),
  limit: z.number().int().min(1).max(100).optional(),
  before: z.string().optional(),
});

export const listPeopleInput = z.object({
  q: z.string().optional().describe("Optional name / role / highlight filter."),
  limit: z.number().int().min(1).max(100).optional(),
});

export const personIdInput = z.object({
  personId: z.string().describe("People DB id (when the backend exists)."),
});

export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

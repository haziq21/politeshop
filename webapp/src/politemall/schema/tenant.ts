/**
 * Zod schemas for Brightspace API responses, adapted from https://docs.valence.desire2learn.com/reference.html.
 */

import z from "zod";

const richText = z.object({
  Text: z.string(),
  Html: z.string(),
});

export const topic = z
  .object({
    Identifier: z.string(),
    // "Note that this property contains the same identifier as the Identifier property, but formatted as a JSON number rather than as a string."
    TopicId: z.number(),
    Title: z.string(),
    Description: richText,
    ActivityType: z.number(),
    TypeIdentifier: z.enum(["Link", "File", "ContentService"]),

    Unread: z.boolean(),
    ToolId: z.number().nullable(),
    ToolItemId: z.number().nullable(),
    SortOrder: z.number(),
  })
  .and(
    z
      .object({ IsBroken: z.literal(false), Url: z.string() })
      .or(z.object({ IsBroken: z.literal(true), Url: z.string().nullable() }))
  );

const baseModule = z.object({
  ModuleId: z.number(),
  Title: z.string(),
  Description: richText,
  SortOrder: z.number(),
  Topics: topic.array(),
});

type BsModule = z.infer<typeof baseModule> & { Modules: BsModule[] };

/** Brightspace calls these "Module" objects, but we call them "units" (folders). */
export const module: z.ZodType<BsModule> = baseModule.extend({
  Modules: z.lazy(() => module.array()),
});

export const tableOfContents = z.object({
  Modules: module.array(),
});

export const file = z.object({
  FileId: z.number(),
  FileName: z.string(),
  Size: z.number(),
});

export const entityDropbox = z.object({
  CompletionDate: z.string().nullable(),
  Submissions: z
    .object({
      Id: z.number(),
      SubmissionDate: z.coerce.date().nullable(),
      Comment: richText,
      Files: file.array(),
    })
    .array(),
});

export const dropboxFolder = z.object({
  Id: z.number(),
  Name: z.string(),
  CustomInstructions: richText,
  Attachments: file.array(),
  DueDate: z.coerce.date().nullable(),
  SubmissionType: z.literal(0),
  CompletionType: z.number(),
});

export const quizReadData = z.object({
  QuizId: z.number(),
  Name: z.string(),
  Instructions: z.object({
    Text: richText,
    IsDisplayed: z.boolean(),
  }),
  Description: z.object({
    Text: richText,
    IsDisplayed: z.boolean(),
  }),
  StartDate: z.coerce.date(),
  EndDate: z.coerce.date(),
  DueDate: z.coerce.date().nullable(),
  SortOrder: z.number(),
  SubmissionTimeLimit: z.object({
    IsEnforced: z.boolean(),
    ShowClock: z.boolean(),
    TimeLimitValue: z.number(),
  }),
  AttemptsAllowed: z.object({
    IsUnlimited: z.boolean(),
    NumberOfAttemptsAllowed: z.number().nullable(),
  }),
  CalcTypeId: z.number(),
  Shuffle: z.boolean(),
});

export function objectListPage<T extends z.Schema>(
  s: T
): z.ZodObject<{ Next: z.ZodNullable<z.ZodString>; Objects: z.ZodArray<T> }> {
  return z.object({
    Next: z.string().nullable(),
    Objects: s.array(),
  });
}

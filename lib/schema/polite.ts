/**
 * Zod schemas for POLITE API (*.polite.edu.sg) responses.
 * Adapted from https://docs.valence.desire2learn.com/reference.html.
 * These schemas only cover the parts of the API used by POLITELib.
 */

import { z } from "zod";

// ── Auth ──────────────────────────────────────────────────────────────────────

/** Response from GET /d2l/lp/auth/oauth2/token */
export const brightspaceToken = z.object({
  access_token: z.string(),
  expires_at: z.number(),
});

export type BrightspaceToken = z.infer<typeof brightspaceToken>;

// ── Users ─────────────────────────────────────────────────────────────────────

/** https://docs.valence.desire2learn.com/res/user.html#User.WhoAmIUser */
export const whoAmIUser = z.object({
  Identifier: z.string(),
  FirstName: z.string(),
  LastName: z.string(),
  /** POLITEMall uses this as the user's email address. */
  UniqueName: z.string(),
  ProfileIdentifier: z.string(),
});

export type WhoAmIUser = z.infer<typeof whoAmIUser>;

// ── Organization ──────────────────────────────────────────────────────────────

/** https://docs.valence.desire2learn.com/res/orgunit.html#Org.Organization */
export const organization = z.object({
  Identifier: z.string(),
  Name: z.string(),
  TimeZone: z.string(),
});

export type Organization = z.infer<typeof organization>;

// ── Enrollments ───────────────────────────────────────────────────────────────

/** https://docs.valence.desire2learn.com/res/enroll.html#Enrollment.MyOrgUnitInfo */
export const myOrgUnitInfo = z.object({
  OrgUnit: z.object({
    Id: z.number(),
    Type: z.object({
      Id: z.number(),
      Code: z.string(),
      Name: z.string(),
    }),
    Name: z.string(),
    Code: z.string().nullable(),
    HomeUrl: z.string().nullable(),
    ImageUrl: z.string().nullable(),
  }),
});

export type MyOrgUnitInfo = z.infer<typeof myOrgUnitInfo>;

export const courseParent = z.object({
  CourseOfferingId: z.string(),
  Semester: z.object({
    Identifier: z.string(),
    Name: z.string(),
    Code: z.string(),
  }),
  Department: z.object({
    Identifier: z.string(),
    Name: z.string(),
    Code: z.string(),
  }),
});

export type CourseParent = z.infer<typeof courseParent>;

// ── Content / Table of Contents ───────────────────────────────────────────────

const richText = z.object({
  Text: z.string(),
  Html: z.string(),
});

export type RichText = z.infer<typeof richText>;

/**
 * `ToC.Topic` of https://docs.valence.desire2learn.com/res/content.html#ToC.TableOfContents
 *
 * ActivityType values:
 *   1 = File / ContentService
 *   2 = Link (web embed)
 *   3 = Dropbox (submission)
 *   4 = Quiz
 */
export const tocTopic = z
  .object({
    Identifier: z.string(),
    /** Same identifier as `Identifier`, but as a number. */
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
      .or(z.object({ IsBroken: z.literal(true), Url: z.string().nullable() })),
  );

export type TOCTopic = z.infer<typeof tocTopic>;

const baseModule = z.object({
  ModuleId: z.number(),
  Title: z.string(),
  Description: richText,
  SortOrder: z.number(),
  Topics: tocTopic.array(),
});

export type TOCModule = z.infer<typeof baseModule> & { Modules: TOCModule[] };

/**
 * Brightspace calls these "Module" objects but POLITELib calls them "activity folders".
 * `ToC.Module` of https://docs.valence.desire2learn.com/res/content.html#ToC.TableOfContents
 */
export const tocModule: z.ZodType<TOCModule> = baseModule.extend({
  Modules: z.lazy(() => tocModule.array()),
});

/** https://docs.valence.desire2learn.com/res/content.html#ToC.TableOfContents */
export const tableOfContents = z.object({
  Modules: tocModule.array(),
});

export type TableOfContents = z.infer<typeof tableOfContents>;

// ── Dropbox / Submissions ─────────────────────────────────────────────────────

const file = z.object({
  FileId: z.number(),
  FileName: z.string(),
  Size: z.number(),
});

/** https://docs.valence.desire2learn.com/res/dropbox.html#Dropbox.EntityDropbox */
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

export type EntityDropbox = z.infer<typeof entityDropbox>;

/** https://docs.valence.desire2learn.com/res/dropbox.html#Dropbox.DropboxFolder */
export const dropboxFolder = z.object({
  Id: z.number(),
  Name: z.string(),
  CustomInstructions: richText,
  Attachments: file.array(),
  DueDate: z.coerce.date().nullable(),
  SubmissionType: z.literal(0),
  CompletionType: z.number(),
  Availability: z
    .object({
      StartDate: z.coerce.date().nullable(),
      EndDate: z.coerce.date().nullable(),
      StartDateAvailabilityType: z.number().nullable(),
      EndDateAvailabilityType: z.number().nullable(),
    })
    .nullable(),
});

export type DropboxFolder = z.infer<typeof dropboxFolder>;

// ── Quizzes ───────────────────────────────────────────────────────────────────

/** https://docs.valence.desire2learn.com/res/quiz.html#Quiz.QuizReadData */
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

export type QuizReadData = z.infer<typeof quizReadData>;

// ── Pagination helpers ────────────────────────────────────────────────────────

/**
 * Wraps a schema in an
 * [ObjectListPage](https://docs.valence.desire2learn.com/basic/apicall.html#Api.ObjectListPage).
 */
export function objectListPage<T extends z.ZodTypeAny>(s: T) {
  return z.object({
    Next: z.string().nullable(),
    Objects: s.array(),
  });
}

export type ObjectListPage<T> = { Next: string | null; Objects: T[] };

/**
 * Wraps a schema in a
 * [PagedResultSet](https://docs.valence.desire2learn.com/basic/apicall.html#Api.PagedResultSet).
 */
export function pagedResultSet<T extends z.ZodTypeAny>(s: T) {
  return z.object({
    PagingInfo: z.object({
      Bookmark: z.string(),
      HasMoreItems: z.boolean(),
    }),
    Items: s.array(),
  });
}

export type PagedResultSet<T> = {
  PagingInfo: { Bookmark: string; HasMoreItems: boolean };
  Items: T[];
};

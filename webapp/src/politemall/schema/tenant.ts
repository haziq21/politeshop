/**
 * Zod schemas for Brightspace API responses, adapted from https://docs.valence.desire2learn.com/reference.html.
 * Note that these schemas are not exhaustive; they only cover the parts of the API used by POLITEShop.
 */

import z from "zod";

/** https://docs.valence.desire2learn.com/res/user.html#User.WhoAmIUser */
export const whoAmIUser = z.object({
  Identifier: z.string(),
  FirstName: z.string(),
  LastName: z.string(),
  // POLITEMall seems to use this as the email address of the user
  UniqueName: z.string(),
  ProfileIdentifier: z.string(),
});

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

const richText = z.object({
  Text: z.string(),
  Html: z.string(),
});

/** `ToC.Topic` of https://docs.valence.desire2learn.com/res/content.html#ToC.TableOfContents */
export const tocTopic = z
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
 * Brightspace calls these "Module" objects, but we call them "units" (folders).
 * `ToC.Module` of https://docs.valence.desire2learn.com/res/content.html#ToC.TableOfContents
 */
export const tocModule: z.ZodType<TOCModule> = baseModule.extend({
  Modules: z.lazy(() => tocModule.array()),
});

/** https://docs.valence.desire2learn.com/res/content.html#ToC.TableOfContents */
export const tableOfContents = z.object({
  Modules: tocModule.array(),
});

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

/** https://docs.valence.desire2learn.com/res/orgunit.html#Org.Organization */
export const organization = z.object({
  Identifier: z.string(),
  Name: z.string(),
  TimeZone: z.string(),
});

/** Wrap a schema in an [ObjectListPage](https://docs.valence.desire2learn.com/basic/apicall.html#Api.ObjectListPage). */
export function objectListPage<T extends z.Schema>(
  s: T
): z.ZodObject<{ Next: z.ZodNullable<z.ZodString>; Objects: z.ZodArray<T> }> {
  return z.object({
    Next: z.string().nullable(),
    Objects: s.array(),
  });
}

/** Wrap a schema in a [PagedResultSet](https://docs.valence.desire2learn.com/basic/apicall.html#Api.PagedResultSet). */
export function pagedResultSet<T extends z.Schema>(
  s: T
): z.ZodObject<{
  PagingInfo: z.ZodObject<{ HasMoreItems: z.ZodBoolean; Bookmark: z.ZodString }>;
  Items: z.ZodArray<T>;
}> {
  return z.object({
    PagingInfo: z.object({
      Bookmark: z.string(),
      HasMoreItems: z.boolean(),
    }),
    Items: s.array(),
  });
}

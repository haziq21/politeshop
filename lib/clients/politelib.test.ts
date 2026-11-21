import { UnsecuredJWT } from "jose";
import { expect, test, vi } from "vite-plus/test";

import type { TOCModule, TOCTopic } from "../schema/polite";

import { sirenEntity } from "../schema/siren";
import { Brightspace } from "./brightspace";
import { POLITELib } from "./politelib";

function fetchToken(expiresInSeconds: number) {
  return new UnsecuredJWT({ tenantid: "tenant-1" })
    .setSubject("user-1")
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .encode();
}

function newLib(config: { d2lFetchToken?: string } = { d2lFetchToken: fetchToken(3600) }) {
  return new POLITELib({ d2lSessionVal: "session", d2lSecureSessionVal: "secure", domain: "nplms", ...config });
}

const richText = { Text: "", Html: "" };

const topic = {
  Identifier: "100",
  TopicId: 100,
  Title: "Topic",
  Description: richText,
  ActivityType: 2,
  TypeIdentifier: "Link",
  Unread: false,
  ToolId: null,
  ToolItemId: null,
  SortOrder: 0,
  IsBroken: false,
  Url: "https://example.com/page",
} satisfies TOCTopic;

const folder = {
  ModuleId: 1,
  Title: "Folder",
  Description: richText,
  SortOrder: 0,
  Topics: [],
  Modules: [],
} satisfies TOCModule;

const moduleInfo = (id: number, { type = 3, code = `M${id}` }: { type?: number; code?: string | null } = {}) => ({
  OrgUnit: {
    Id: id,
    Type: { Id: type, Code: "", Name: "" },
    Name: `Module ${id}`,
    Code: code,
    HomeUrl: null,
    ImageUrl: null,
  },
});

// ── User & institution ────────────────────────────────────────────────────────

test("getUser maps the identifier and first name", async () => {
  const lib = newLib();
  vi.spyOn(lib.polite, "whoAmI").mockResolvedValue({
    Identifier: "42",
    FirstName: "Sam",
    LastName: "Tan",
    UniqueName: "sam@example.com",
    ProfileIdentifier: "p",
  });

  expect(await lib.getUser()).toEqual({ id: "42", name: "Sam" });
});

test("getInstitutionImageURL fetches the institution only when it isn't given the ID", async () => {
  const lib = newLib();
  const getOrganizationInfo = vi
    .spyOn(lib.polite, "getOrganizationInfo")
    .mockResolvedValue({ Identifier: "org-1", Name: "Poly", TimeZone: "UTC" });

  const url = "https://nplms.polite.edu.sg/d2l/api/lp/1.46/courses/org-1/image?width=10&height=20";

  expect(await lib.getInstitutionImageURL({ width: 10, height: 20 })).toBe(url);
  expect(lib.getInstitutionImageURL({ width: 10, height: 20, institutionId: "org-1" })).toBe(url);
  expect(getOrganizationInfo).toHaveBeenCalledTimes(1);
});

// ── Modules & semesters ───────────────────────────────────────────────────────

test("getModules keeps only course offerings, follows pagination and defaults a missing code to empty", async () => {
  const lib = newLib();
  const getMyEnrollments = vi
    .spyOn(lib.polite, "getMyEnrollments")
    .mockResolvedValueOnce({
      PagingInfo: { Bookmark: "page-2", HasMoreItems: true },
      Items: [moduleInfo(1), moduleInfo(99, { type: 1 })],
    })
    .mockResolvedValueOnce({
      PagingInfo: { Bookmark: "", HasMoreItems: false },
      Items: [moduleInfo(2, { code: null })],
    });

  expect(await lib.getModules()).toEqual([
    { id: "1", name: "Module 1", code: "M1" },
    { id: "2", name: "Module 2", code: "" },
  ]);
  expect(getMyEnrollments).toHaveBeenNthCalledWith(1, { bookmark: undefined });
  expect(getMyEnrollments).toHaveBeenNthCalledWith(2, { bookmark: "page-2" });
});

test("getModulesAndSemesters pairs each module with its semester and deduplicates semesters", async () => {
  const lib = newLib();
  vi.spyOn(lib, "getModules").mockResolvedValue([
    { id: "1", name: "A", code: "A" },
    { id: "2", name: "B", code: "B" },
    { id: "3", name: "C", code: "C" },
  ]);
  const semester = (id: string, name: string) => ({
    CourseOfferingId: "",
    Semester: { Identifier: id, Name: name, Code: "" },
    Department: { Identifier: "d", Name: "d", Code: "d" },
  });
  vi.spyOn(lib.polite, "getParentOrgUnits").mockResolvedValue([
    semester("s1", " Sem 1 "),
    semester("s2", "Sem 2"),
    semester("s1", " Sem 1 "),
  ]);

  const { modules, semesters } = await lib.getModulesAndSemesters();

  expect(modules.map((m) => [m.id, m.semesterId])).toEqual([
    ["1", "s1"],
    ["2", "s2"],
    ["3", "s1"],
  ]);
  expect(semesters).toEqual([
    { id: "s1", name: "Sem 1" },
    { id: "s2", name: "Sem 2" },
  ]);
});

test("getModulesAndSemesters requests parent org units 25 modules at a time", async () => {
  const lib = newLib();
  const ids = Array.from({ length: 26 }, (_, i) => String(i + 1));
  vi.spyOn(lib, "getModules").mockResolvedValue(ids.map((id) => ({ id, name: id, code: id })));
  const getParentOrgUnits = vi.spyOn(lib.polite, "getParentOrgUnits").mockImplementation(async ({ orgUnitIdsCSV }) =>
    orgUnitIdsCSV.split(",").map(() => ({
      CourseOfferingId: "",
      Semester: { Identifier: "s", Name: "s", Code: "" },
      Department: { Identifier: "d", Name: "d", Code: "d" },
    })),
  );

  const { modules } = await lib.getModulesAndSemesters();

  expect(getParentOrgUnits).toHaveBeenCalledTimes(2);
  expect(getParentOrgUnits.mock.calls[0]![0].orgUnitIdsCSV.split(",")).toHaveLength(25);
  expect(getParentOrgUnits.mock.calls[1]![0].orgUnitIdsCSV).toBe("26");
  expect(modules).toHaveLength(26);
});

// ── Module activities ─────────────────────────────────────────────────────────

test("getModuleActivities flattens folders with parentId, each folder before its children", async () => {
  const lib = newLib();
  vi.spyOn(lib.polite, "getModuleTOC").mockResolvedValue({
    Modules: [
      {
        ...folder,
        ModuleId: 1,
        Title: "Week 1",
        Description: { Text: "", Html: "<p>Start</p>" },
        Topics: [{ ...topic, Identifier: "100", Title: "Link", SortOrder: 0 }],
        Modules: [
          {
            ...folder,
            ModuleId: 2,
            Title: "Readings",
            SortOrder: 1,
            Topics: [{ ...topic, Identifier: "101", Title: "Nested link" }],
          },
        ],
      },
      { ...folder, ModuleId: 3, Title: "Week 2", SortOrder: 1 },
    ],
  });

  const activities = await lib.getModuleActivities({ moduleId: "m1" });

  expect(activities).toEqual([
    { type: "folder", id: "1", name: "Week 1", description: "<p>Start</p>", sortOrder: 0, parentId: null },
    { type: "web_embed", id: "100", name: "Link", url: "https://example.com/page", sortOrder: 0, parentId: "1" },
    { type: "folder", id: "2", name: "Readings", description: "", sortOrder: 1, parentId: "1" },
    {
      type: "web_embed",
      id: "101",
      name: "Nested link",
      url: "https://example.com/page",
      sortOrder: 0,
      parentId: "2",
    },
    { type: "folder", id: "3", name: "Week 2", description: "", sortOrder: 1, parentId: null },
  ]);
});

test("getModuleActivities skips broken topics", async () => {
  const lib = newLib();
  vi.spyOn(lib.polite, "getModuleTOC").mockResolvedValue({
    Modules: [
      {
        ...folder,
        Topics: [
          { ...topic, Identifier: "100" },
          { ...topic, Identifier: "101", IsBroken: true, Url: null },
        ],
      },
    ],
  });

  const activities = await lib.getModuleActivities({ moduleId: "m1" });

  expect(activities.map((a) => a.id)).toEqual(["1", "100"]);
});

async function parseTopic(lib: POLITELib, fields: Partial<TOCTopic>) {
  vi.spyOn(lib.polite, "getModuleTOC").mockResolvedValue({
    Modules: [{ ...folder, Topics: [{ ...topic, ...fields } as TOCTopic] }],
  });
  const [, activity] = await lib.getModuleActivities({ moduleId: "m1" });
  return activity;
}

test("an HTML file topic stores the fetched page content", async () => {
  const lib = newLib();
  const getContentHTML = vi.spyOn(lib.polite, "getContentHTML").mockResolvedValue("<p>Hello</p>");

  const activity = await parseTopic(lib, { ActivityType: 1, TypeIdentifier: "File", Url: "/content/intro.html" });

  expect(activity).toMatchObject({ type: "html", content: "<p>Hello</p>" });
  expect(getContentHTML).toHaveBeenCalledWith({ urlOrPath: "/content/intro.html" });
});

test("a non-HTML file topic becomes a doc embed with the preview link and its expiry", async () => {
  const lib = newLib();
  const previewURL = "https://bucket.s3.amazonaws.com/p.pdf?X-Amz-Date=2026-03-18T04:00:00Z&X-Amz-Expires=3600";
  const getActivity = vi.spyOn(Brightspace.prototype, "getActivity").mockResolvedValue(
    sirenEntity.parse({
      class: ["activity"],
      entities: [
        {
          class: ["activity", "file-activity"],
          entities: [
            { class: ["file"], links: [{ class: ["pdf", "d2l-converted-doc"], rel: ["alternate"], href: previewURL }] },
          ],
        },
      ],
    }),
  );

  const activity = await parseTopic(lib, {
    TopicId: 7,
    ActivityType: 1,
    TypeIdentifier: "File",
    Url: "/content/slides.pptx",
  });

  expect(activity).toMatchObject({
    type: "doc_embed",
    sourceURL: "https://nplms.polite.edu.sg/content/slides.pptx",
    previewURL,
  });
  expect(activity).toHaveProperty("previewURLExpiry", Temporal.Instant.from("2026-03-18T05:00:00Z"));
  expect(getActivity).toHaveBeenCalledWith({ moduleId: "m1", topicId: 7 });
});

test("a doc embed has no preview when Brightspace offers no converted copy", async () => {
  const lib = newLib();
  vi.spyOn(Brightspace.prototype, "getActivity").mockResolvedValue(
    sirenEntity.parse({
      class: ["activity"],
      entities: [{ class: ["activity", "file-activity"], entities: [{ class: ["file"] }] }],
    }),
  );

  const activity = await parseTopic(lib, { ActivityType: 1, TypeIdentifier: "File", Url: "/content/a.zip" });

  expect(activity).toMatchObject({ type: "doc_embed", previewURL: undefined, previewURLExpiry: undefined });
});

test("a Content Service topic becomes a video embed with media and thumbnail URLs", async () => {
  const lib = newLib();
  const mediaURL = "https://t.content-service.brightspace.com/v.mp4?Expires=1773810000";
  vi.spyOn(Brightspace.prototype, "getTopicMedia").mockResolvedValue(
    sirenEntity.parse({ class: ["media"], properties: { src: mediaURL } }),
  );
  vi.spyOn(Brightspace.prototype, "getTopicThumbnail").mockResolvedValue(
    sirenEntity.parse({
      class: ["topic"],
      entities: [
        { class: ["thumbnail"], properties: { src: "https://t.example.com/thumb.png", expires: "1773900000" } },
      ],
    }),
  );

  const activity = await parseTopic(lib, { ActivityType: 1, TypeIdentifier: "ContentService", Url: "x" });

  expect(activity).toMatchObject({
    type: "video_embed",
    sourceURL: mediaURL,
    thumbnailURL: "https://t.example.com/thumb.png",
  });
  expect(activity).toHaveProperty("sourceURLExpiry", Temporal.Instant.fromEpochMilliseconds(1773810000 * 1000));
  // The explicit `expires` field wins; the thumbnail URL itself carries none
  expect(activity).toHaveProperty("thumbnailURLExpiry", Temporal.Instant.fromEpochMilliseconds(1773900000 * 1000));
});

test("submission and quiz topics reference their tool item as a string ID", async () => {
  const lib = newLib();

  expect(await parseTopic(lib, { ActivityType: 3, ToolItemId: 55 })).toMatchObject({
    type: "submission",
    dropboxId: "55",
  });
  expect(await parseTopic(lib, { ActivityType: 4, ToolItemId: 66 })).toMatchObject({ type: "quiz", quizId: "66" });
});

test("a submission or quiz topic without a tool item is an error", async () => {
  const lib = newLib();

  await expect(parseTopic(lib, { ActivityType: 3, ToolItemId: null })).rejects.toThrow("Missing ToolItemId");
  await expect(parseTopic(lib, { ActivityType: 4, ToolItemId: null })).rejects.toThrow("Missing ToolItemId");
});

test("a topic of an unrecognised type is kept as unknown", async () => {
  const lib = newLib();

  expect(await parseTopic(lib, { ActivityType: 9 })).toMatchObject({ type: "unknown", id: "100", parentId: "1" });
});

// ── Dropboxes & submissions ───────────────────────────────────────────────────

test("getSubmissionDropboxes maps dropbox folders", async () => {
  const lib = newLib();
  const dropbox = {
    Id: 5,
    Name: "Report",
    CustomInstructions: { Text: "", Html: "<p>Do it</p>" },
    Attachments: [],
    SubmissionType: 0 as const,
    CompletionType: 0,
  };
  vi.spyOn(lib.polite, "getDropboxFolders").mockResolvedValue([
    {
      ...dropbox,
      DueDate: Temporal.Instant.from("2026-03-19T12:00:00Z"),
      Availability: {
        StartDate: Temporal.Instant.from("2026-03-01T00:00:00Z"),
        EndDate: Temporal.Instant.from("2026-03-20T00:00:00Z"),
        StartDateAvailabilityType: 1,
        EndDateAvailabilityType: 1,
      },
    },
    { ...dropbox, Id: 6, DueDate: null, Availability: null },
  ]);

  expect(await lib.getSubmissionDropboxes({ moduleId: "m1" })).toEqual([
    {
      id: "5",
      name: "Report",
      moduleId: "m1",
      description: "<p>Do it</p>",
      dueAt: Temporal.Instant.from("2026-03-19T12:00:00Z"),
      opensAt: Temporal.Instant.from("2026-03-01T00:00:00Z"),
      closesAt: Temporal.Instant.from("2026-03-20T00:00:00Z"),
    },
    {
      id: "6",
      name: "Report",
      moduleId: "m1",
      description: "<p>Do it</p>",
      dueAt: null,
      opensAt: undefined,
      closesAt: undefined,
    },
  ]);
});

test("getSubmissions maps the submissions the POLITE API returns", async () => {
  const lib = newLib();
  vi.spyOn(lib.polite, "getDropboxSubmissions").mockResolvedValue([
    {
      CompletionDate: null,
      Submissions: [
        {
          Id: 1,
          SubmissionDate: Temporal.Instant.from("2026-03-11T09:00:00Z"),
          Comment: { Text: "", Html: "<p>v1</p>" },
          Files: [],
        },
      ],
    },
  ]);

  expect(await lib.getSubmissions({ moduleId: "m1", dropboxId: "d1" })).toEqual([
    { id: "1", dropboxId: "d1", submittedAt: Temporal.Instant.from("2026-03-11T09:00:00Z"), comment: "<p>v1</p>" },
  ]);
});

test("getSubmissions returns nothing when the user has no dropbox entry", async () => {
  const lib = newLib();
  vi.spyOn(lib.polite, "getDropboxSubmissions").mockResolvedValue([]);

  expect(await lib.getSubmissions({ moduleId: "m1", dropboxId: "d1" })).toEqual([]);
});

test("getSubmissions falls back to Brightspace when the POLITE API refuses a closed dropbox", async () => {
  const lib = newLib();
  vi.spyOn(lib.polite, "getDropboxSubmissions").mockRejectedValue(new Error("403"));
  const getInstitution = vi.spyOn(lib, "getInstitution").mockResolvedValue({ id: "org-1", name: "Poly" });
  const getClosedDropboxSubmissions = vi.spyOn(Brightspace.prototype, "getClosedDropboxSubmissions").mockResolvedValue(
    sirenEntity.parse({
      class: ["root"],
      entities: [
        {
          class: ["assignment-submission-list"],
          links: [{ rel: ["item"], href: "https://assignments.example.com/submissions/77" }],
        },
      ],
    }),
  );
  vi.spyOn(Brightspace.prototype, "getSubmissionDetails").mockResolvedValue(
    sirenEntity.parse({
      class: ["submission"],
      entities: [
        { class: ["submission-date"], properties: { date: "2026-03-12T09:00:00.000Z" } },
        { class: ["submission-comment"], properties: { html: "<p>late</p>" } },
      ],
    }),
  );

  expect(await lib.getSubmissions({ moduleId: "m1", dropboxId: "d1" })).toEqual([
    { id: "77", dropboxId: "d1", submittedAt: Temporal.Instant.from("2026-03-12T09:00:00Z"), comment: "<p>late</p>" },
  ]);
  expect(getInstitution).toHaveBeenCalledTimes(1);
  expect(getClosedDropboxSubmissions).toHaveBeenCalledWith({ orgId: "org-1", dropboxId: "d1", moduleId: "m1" });
});

test("the Brightspace fallback skips the institution lookup when given the organization", async () => {
  const lib = newLib();
  vi.spyOn(lib.polite, "getDropboxSubmissions").mockRejectedValue(new Error("403"));
  const getInstitution = vi.spyOn(lib, "getInstitution");
  vi.spyOn(Brightspace.prototype, "getClosedDropboxSubmissions").mockResolvedValue(
    sirenEntity.parse({ class: ["root"], entities: [{ class: ["assignment-submission-list"] }] }),
  );

  expect(await lib.getSubmissions({ moduleId: "m1", dropboxId: "d1", organizationId: "org-9" })).toEqual([]);
  expect(getInstitution).not.toHaveBeenCalled();
});

// ── Quizzes ───────────────────────────────────────────────────────────────────

test("getQuizzes follows Next links until the last page", async () => {
  const lib = newLib();
  const quiz = (id: number, name: string) => ({
    QuizId: id,
    Name: name,
    Instructions: { Text: richText, IsDisplayed: false },
    Description: { Text: { Text: "", Html: `<p>${name}</p>` }, IsDisplayed: true },
    StartDate: Temporal.Instant.from("2026-03-01T00:00:00Z"),
    EndDate: Temporal.Instant.from("2026-03-31T00:00:00Z"),
    DueDate: id === 1 ? Temporal.Instant.from("2026-03-21T12:00:00Z") : null,
    SortOrder: 0,
    SubmissionTimeLimit: { IsEnforced: false, ShowClock: false, TimeLimitValue: 0 },
    AttemptsAllowed: { IsUnlimited: true, NumberOfAttemptsAllowed: null },
    CalcTypeId: 0,
    Shuffle: false,
  });
  const getQuizzesPage = vi
    .spyOn(lib.polite, "getQuizzesPage")
    .mockResolvedValueOnce({ Next: "/d2l/api/le/1.75/m1/quizzes/?bookmark=2", Objects: [quiz(1, "Quiz A")] })
    .mockResolvedValueOnce({ Next: null, Objects: [quiz(2, "Quiz B")] });

  expect(await lib.getQuizzes({ moduleId: "m1" })).toEqual([
    {
      id: "1",
      moduleId: "m1",
      name: "Quiz A",
      description: "<p>Quiz A</p>",
      dueAt: Temporal.Instant.from("2026-03-21T12:00:00Z"),
    },
    { id: "2", moduleId: "m1", name: "Quiz B", description: "<p>Quiz B</p>", dueAt: null },
  ]);
  expect(getQuizzesPage).toHaveBeenNthCalledWith(1, { urlOrPath: "/d2l/api/le/1.75/m1/quizzes/" });
  expect(getQuizzesPage).toHaveBeenNthCalledWith(2, { urlOrPath: "/d2l/api/le/1.75/m1/quizzes/?bookmark=2" });
});

// ── Brightspace token ─────────────────────────────────────────────────────────

test("brightspace reuses the client while its token is valid", async () => {
  const lib = newLib();
  const getNewFetchToken = vi.spyOn(lib.polite, "getNewFetchToken");

  expect(await lib.brightspace).toBe(await lib.brightspace);
  expect(getNewFetchToken).not.toHaveBeenCalled();
});

test("brightspace fetches a token on first use when none was given", async () => {
  const lib = newLib({});
  const getNewFetchToken = vi
    .spyOn(lib.polite, "getNewFetchToken")
    .mockResolvedValue({ access_token: fetchToken(3600), expires_at: 0 });

  const client = await lib.brightspace;

  expect(await lib.brightspace).toBe(client);
  expect(getNewFetchToken).toHaveBeenCalledTimes(1);
});

test("brightspace replaces the client once its token has expired", async () => {
  const lib = newLib({ d2lFetchToken: fetchToken(-60) });
  const getNewFetchToken = vi
    .spyOn(lib.polite, "getNewFetchToken")
    .mockResolvedValue({ access_token: fetchToken(3600), expires_at: 0 });

  const client = await lib.brightspace;

  expect(getNewFetchToken).toHaveBeenCalledTimes(1);
  expect(client.tokenExpiry.epochMilliseconds).toBeGreaterThan(Date.now());
});

import { UnsecuredJWT } from "jose";
import { expect, test, vi } from "vite-plus/test";

import { POLITELib } from "./politelib";

/** A `fetch` that answers by request path (and query, when listed), so a test lists only the endpoints it expects. */
function serve(responses: Record<string, unknown>): typeof fetch {
  return async (input) => {
    const url = input as URL;
    const answer = responses[url.pathname + url.search] ?? responses[url.pathname];
    if (answer === undefined) throw new Error(`Unexpected request to ${url.href}`);
    if (answer instanceof Response) return answer;
    return typeof answer === "string" ? new Response(answer) : Response.json(answer);
  };
}

const validToken = new UnsecuredJWT({ tenantid: "11111111-1111-4111-8111-111111111111" })
  .setSubject("12345")
  .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
  .encode();
const expiredToken = new UnsecuredJWT({ tenantid: "11111111-1111-4111-8111-111111111111" })
  .setSubject("12345")
  .setExpirationTime(1)
  .encode();

const credentials = { d2lSessionVal: "session", d2lSecureSessionVal: "secure", domain: "nplms" };
const richText = { Text: "", Html: "" };

// Response shapes as the APIs send them, with only the quirks each test cares about overridden
const course = { Type: { Id: 3, Code: "", Name: "" }, HomeUrl: null, ImageUrl: null };
const department = { Identifier: "d", Name: "d", Code: "d" };
const fileTopic = {
  Identifier: "100",
  TopicId: 100,
  Title: "Slides",
  Description: richText,
  ActivityType: 1,
  TypeIdentifier: "File",
  Unread: false,
  ToolId: null,
  ToolItemId: null,
  SortOrder: 0,
  IsBroken: false,
  Url: "/content/slides.pptx",
};
const weekToc = (topics: unknown[]) => ({
  Modules: [{ ModuleId: 1, Title: "Week 1", Description: richText, SortOrder: 0, Topics: topics, Modules: [] }],
});
const dropbox = {
  Id: 5,
  Name: "Report",
  CustomInstructions: { Text: "", Html: "<p>Do it</p>" },
  Attachments: [],
  SubmissionType: 0,
  CompletionType: 0,
};
const quiz = {
  QuizId: 1,
  Name: "Quiz",
  Instructions: { Text: richText, IsDisplayed: false },
  Description: { Text: richText, IsDisplayed: false },
  StartDate: "2026-03-01T00:00:00.000Z",
  EndDate: "2026-03-31T00:00:00.000Z",
  DueDate: "2026-03-21T12:00:00.000Z",
  SortOrder: 0,
  SubmissionTimeLimit: { IsEnforced: false, ShowClock: false, TimeLimitValue: 0 },
  AttemptsAllowed: { IsUnlimited: true, NumberOfAttemptsAllowed: null },
  CalcTypeId: 0,
  Shuffle: false,
};

// ── User & institution ────────────────────────────────────────────────────────

test("getUser returns the user's ID and first name", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/lp/1.0/users/whoami": {
        Identifier: "42",
        FirstName: "Sam",
        LastName: "Tan",
        UniqueName: "sam@example.com",
        ProfileIdentifier: "p",
      },
    }),
  });

  expect(await lib.getUser()).toEqual({ id: "42", name: "Sam" });
});

test("getInstitutionImageURL only looks the institution up when it isn't given the ID", async () => {
  const fetch = vi.fn(
    serve({ "/d2l/api/lp/1.46/organization/info": { Identifier: "org-1", Name: "Poly", TimeZone: "UTC" } }),
  );
  const lib = new POLITELib({ ...credentials, d2lFetchToken: validToken, fetch });
  const url = "https://nplms.polite.edu.sg/d2l/api/lp/1.46/courses/org-1/image?width=10&height=20";

  expect(await lib.getInstitutionImageURL({ width: 10, height: 20 })).toBe(url);
  expect(lib.getInstitutionImageURL({ width: 10, height: 20, institutionId: "org-1" })).toBe(url);
  expect(fetch).toHaveBeenCalledTimes(1);
});

// ── Modules & semesters ───────────────────────────────────────────────────────

test("getModules skips non-course enrollments, follows pagination and defaults a missing code to empty", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/lp/1.46/enrollments/myenrollments/": {
        PagingInfo: { Bookmark: "page-2", HasMoreItems: true },
        Items: [
          { OrgUnit: { ...course, Id: 1, Name: "Module 1", Code: "M1" } },
          { OrgUnit: { ...course, Id: 99, Name: "Department", Code: "D", Type: { Id: 1, Code: "", Name: "" } } },
        ],
      },
      "/d2l/api/lp/1.46/enrollments/myenrollments/?bookmark=page-2": {
        PagingInfo: { Bookmark: "", HasMoreItems: false },
        Items: [{ OrgUnit: { ...course, Id: 2, Name: "Module 2", Code: null } }],
      },
    }),
  });

  expect(await lib.getModules()).toEqual([
    { id: "1", name: "Module 1", code: "M1" },
    { id: "2", name: "Module 2", code: "" },
  ]);
});

test("getModulesAndSemesters pairs each module with its semester and lists each semester once", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/lp/1.46/enrollments/myenrollments/": {
        PagingInfo: { Bookmark: "", HasMoreItems: false },
        Items: [
          { OrgUnit: { ...course, Id: 1, Name: "A", Code: "A" } },
          { OrgUnit: { ...course, Id: 2, Name: "B", Code: "B" } },
          { OrgUnit: { ...course, Id: 3, Name: "C", Code: "C" } },
        ],
      },
      "/d2l/api/lp/1.46/courses/parentorgunits": [
        { CourseOfferingId: "1", Semester: { Identifier: "s1", Name: " Sem 1 ", Code: "" }, Department: department },
        { CourseOfferingId: "2", Semester: { Identifier: "s2", Name: "Sem 2", Code: "" }, Department: department },
        { CourseOfferingId: "3", Semester: { Identifier: "s1", Name: " Sem 1 ", Code: "" }, Department: department },
      ],
    }),
  });

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

test("getModulesAndSemesters asks for parent org units 25 modules at a time", async () => {
  const ids = Array.from({ length: 26 }, (_, i) => i + 1);
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: async (input) => {
      const url = input as URL;
      if (url.pathname === "/d2l/api/lp/1.46/enrollments/myenrollments/") {
        return Response.json({
          PagingInfo: { Bookmark: "", HasMoreItems: false },
          Items: ids.map((id) => ({ OrgUnit: { ...course, Id: id, Name: `Module ${id}`, Code: `M${id}` } })),
        });
      }
      const requested = url.searchParams.get("orgUnitIdsCSV")!.split(",");
      if (requested.length > 25) return new Response("", { status: 400 });
      return Response.json(
        requested.map((id) => ({
          CourseOfferingId: id,
          Semester: { Identifier: "s1", Name: "Sem 1", Code: "" },
          Department: department,
        })),
      );
    },
  });

  const { modules } = await lib.getModulesAndSemesters();

  expect(modules).toHaveLength(26);
});

// ── Module activities ─────────────────────────────────────────────────────────

test("getModuleActivities lists each folder before its contents and leaves out broken topics", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/le/1.75/m1/content/toc": {
        Modules: [
          {
            ModuleId: 1,
            Title: "Week 1",
            Description: { Text: "", Html: "<p>Start</p>" },
            SortOrder: 0,
            Topics: [
              {
                ...fileTopic,
                Identifier: "100",
                Title: "Link",
                ActivityType: 2,
                TypeIdentifier: "Link",
                Url: "https://example.com/page",
              },
              { ...fileTopic, Identifier: "101", IsBroken: true, Url: null },
            ],
            Modules: [{ ModuleId: 2, Title: "Readings", Description: richText, SortOrder: 1, Topics: [], Modules: [] }],
          },
        ],
      },
    }),
  });

  expect(await lib.getModuleActivities({ moduleId: "m1" })).toEqual([
    { type: "folder", id: "1", name: "Week 1", description: "<p>Start</p>", sortOrder: 0, parentId: null },
    { type: "web_embed", id: "100", name: "Link", url: "https://example.com/page", sortOrder: 0, parentId: "1" },
    { type: "folder", id: "2", name: "Readings", description: "", sortOrder: 1, parentId: "1" },
  ]);
});

test("getModuleActivities stores the content of an HTML page", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/le/1.75/m1/content/toc": weekToc([{ ...fileTopic, Url: "/content/intro.html" }]),
      "/content/intro.html": "<p>Hello</p>",
    }),
  });

  const [, page] = await lib.getModuleActivities({ moduleId: "m1" });

  expect(page).toMatchObject({ type: "html", content: "<p>Hello</p>" });
});

test("getModuleActivities gives a converted document a preview URL and its expiry", async () => {
  const previewURL = "https://bucket.s3.amazonaws.com/p.pdf?X-Amz-Date=2026-03-18T04:00:00Z&X-Amz-Expires=3600";
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/le/1.75/m1/content/toc": weekToc([fileTopic]),
      "/m1/activity/100": {
        class: ["activity"],
        entities: [
          {
            class: ["activity", "file-activity"],
            entities: [
              {
                class: ["file"],
                links: [{ class: ["pdf", "d2l-converted-doc"], rel: ["alternate"], href: previewURL }],
              },
            ],
          },
        ],
      },
    }),
  });

  const [, doc] = await lib.getModuleActivities({ moduleId: "m1" });

  expect(doc).toMatchObject({
    type: "doc_embed",
    sourceURL: "https://nplms.polite.edu.sg/content/slides.pptx",
    previewURL,
    previewURLExpiry: Temporal.Instant.from("2026-03-18T05:00:00Z"),
  });
});

test("getModuleActivities keeps a document that is still being converted, without a preview", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/le/1.75/m1/content/toc": weekToc([fileTopic]),
      "/m1/activity/100": {
        class: ["activity"],
        entities: [{ class: ["activity", "file-activity"], entities: [{ class: ["file", "processing"] }] }],
      },
    }),
  });

  const [, doc] = await lib.getModuleActivities({ moduleId: "m1" });

  expect(doc).toMatchObject({ type: "doc_embed", previewURL: undefined, previewURLExpiry: undefined });
});

test("getModuleActivities gives a video its media and thumbnail URLs with their expiry", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/le/1.75/m1/content/toc": weekToc([{ ...fileTopic, TypeIdentifier: "ContentService", Url: "x" }]),
      "/topics/m1/100/media": {
        class: ["media"],
        properties: { src: "https://t.content-service.brightspace.com/v.mp4?Expires=1773810000" },
      },
      "/topics/m1/100": {
        class: ["topic"],
        entities: [
          { class: ["thumbnail"], properties: { src: "https://t.example.com/thumb.png", expires: "1773900000" } },
        ],
      },
    }),
  });

  const [, video] = await lib.getModuleActivities({ moduleId: "m1" });

  expect(video).toMatchObject({
    type: "video_embed",
    sourceURL: "https://t.content-service.brightspace.com/v.mp4?Expires=1773810000",
    sourceURLExpiry: Temporal.Instant.fromEpochMilliseconds(1773810000 * 1000),
    thumbnailURL: "https://t.example.com/thumb.png",
    thumbnailURLExpiry: Temporal.Instant.fromEpochMilliseconds(1773900000 * 1000),
  });
});

test("getModuleActivities points submission and quiz topics at their tool item, and keeps unrecognised topics", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/le/1.75/m1/content/toc": weekToc([
        { ...fileTopic, Identifier: "1", ActivityType: 3, ToolItemId: 55 },
        { ...fileTopic, Identifier: "2", ActivityType: 4, ToolItemId: 66 },
        { ...fileTopic, Identifier: "3", ActivityType: 9 },
      ]),
    }),
  });

  expect(await lib.getModuleActivities({ moduleId: "m1" })).toMatchObject([
    { type: "folder" },
    { type: "submission", id: "1", dropboxId: "55" },
    { type: "quiz", id: "2", quizId: "66" },
    { type: "unknown", id: "3" },
  ]);
});

// ── Dropboxes & submissions ───────────────────────────────────────────────────

test("getSubmissionDropboxes returns each dropbox's dates, leaving out the ones it doesn't have", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/le/1.75/m1/dropbox/folders/": [
        {
          ...dropbox,
          DueDate: "2026-03-19T12:00:00.000Z",
          Availability: {
            StartDate: "2026-03-01T00:00:00.000Z",
            EndDate: "2026-03-20T00:00:00.000Z",
            StartDateAvailabilityType: 1,
            EndDateAvailabilityType: 1,
          },
        },
        { ...dropbox, Id: 6, DueDate: null, Availability: null },
      ],
    }),
  });

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
    { id: "6", name: "Report", moduleId: "m1", description: "<p>Do it</p>", dueAt: null },
  ]);
});

test("getSubmissions returns the user's submissions to a dropbox", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/le/1.75/m1/dropbox/folders/d1/submissions/": [
        {
          Entity: { DisplayName: "Sam", EntityId: 1, EntityType: "User", Active: true },
          Status: 1,
          Feedback: null,
          CompletionDate: null,
          Submissions: [
            {
              Id: 1,
              SubmittedBy: { Identifier: "1", DisplayName: "Sam" },
              SubmissionDate: "2026-03-11T09:00:00.000Z",
              Comment: { Text: "", Html: "<p>v1</p>" },
              Files: [],
            },
          ],
        },
      ],
    }),
  });

  expect(await lib.getSubmissions({ moduleId: "m1", dropboxId: "d1" })).toEqual([
    { id: "1", dropboxId: "d1", submittedAt: Temporal.Instant.from("2026-03-11T09:00:00Z"), comment: "<p>v1</p>" },
  ]);
});

test("getSubmissions returns nothing when the user hasn't submitted to the dropbox", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({ "/d2l/api/le/1.75/m1/dropbox/folders/d1/submissions/": [] }),
  });

  expect(await lib.getSubmissions({ moduleId: "m1", dropboxId: "d1" })).toEqual([]);
});

test("getSubmissions falls back to Brightspace for a closed dropbox, which POLITE refuses with a 403", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/le/1.75/m1/dropbox/folders/d1/submissions/": new Response("", { status: 403 }),
      "/d2l/api/lp/1.46/organization/info": { Identifier: "org-1", Name: "Poly", TimeZone: "UTC" },
      "/old/activities/org-1_2000_d1/usages/m1/users/12345": {
        class: ["root"],
        entities: [
          {
            class: ["assignment-submission-list"],
            links: [
              {
                rel: ["item"],
                href: "https://11111111-1111-4111-8111-111111111111.assignments.api.brightspace.com/submissions/77",
              },
            ],
          },
        ],
      },
      "/submissions/77": {
        class: ["submission"],
        entities: [
          { class: ["submission-date"], properties: { date: "2026-03-12T09:00:00.000Z" } },
          { class: ["submission-comment"], properties: { html: "<p>late</p>" } },
        ],
      },
    }),
  });

  expect(await lib.getSubmissions({ moduleId: "m1", dropboxId: "d1" })).toEqual([
    { id: "77", dropboxId: "d1", submittedAt: Temporal.Instant.from("2026-03-12T09:00:00Z"), comment: "<p>late</p>" },
  ]);
});

test("getSubmissions doesn't fall back to Brightspace when POLITE fails for any other reason", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({ "/d2l/api/le/1.75/m1/dropbox/folders/d1/submissions/": new Response("", { status: 500 }) }),
  });

  await expect(lib.getSubmissions({ moduleId: "m1", dropboxId: "d1" })).rejects.toThrow("Received 500");
});

// ── Quizzes ───────────────────────────────────────────────────────────────────

test("getQuizzes follows pages, and accepts a quiz with no start, end or due date", async () => {
  const lib = new POLITELib({
    ...credentials,
    d2lFetchToken: validToken,
    fetch: serve({
      "/d2l/api/le/1.75/m1/quizzes/": {
        Next: "/d2l/api/le/1.75/m1/quizzes/?bookmark=2",
        Objects: [{ ...quiz, Name: "Quiz A" }],
      },
      "/d2l/api/le/1.75/m1/quizzes/?bookmark=2": {
        Next: null,
        Objects: [{ ...quiz, QuizId: 2, Name: "Quiz B", StartDate: null, EndDate: null, DueDate: null }],
      },
    }),
  });

  expect(await lib.getQuizzes({ moduleId: "m1" })).toEqual([
    { id: "1", moduleId: "m1", name: "Quiz A", description: "", dueAt: Temporal.Instant.from("2026-03-21T12:00:00Z") },
    { id: "2", moduleId: "m1", name: "Quiz B", description: "", dueAt: null },
  ]);
});

test("aborting the signal also stops a Brightspace client created by a token refresh", async () => {
  const controller = new AbortController();
  const lib = new POLITELib({
    ...credentials,
    signal: controller.signal,
    fetch: async (input, init) => {
      const url = input as URL;
      if (url.pathname === "/d2l/home") return new Response(`<script>localStorage.setItem('XSRF.Token','x');</script>`);
      if (url.pathname === "/d2l/lp/auth/oauth2/token")
        return Response.json({ access_token: validToken, expires_at: 0 });
      return new Promise((_resolve, reject) =>
        init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason)),
      );
    },
  });
  const brightspace = await lib.brightspace;

  const request = brightspace.getTopicMedia({ moduleId: "m1", activityId: "a1" });
  controller.abort();

  await expect(request).rejects.toThrow("aborted");
});

// ── Brightspace token ─────────────────────────────────────────────────────────

const tokenEndpoints = {
  "/d2l/home": `<script>localStorage.setItem('XSRF.Token','xsrf');</script>`,
  "/d2l/lp/auth/oauth2/token": { access_token: validToken, expires_at: 0 },
};

test("brightspace reuses its client while the token is valid", async () => {
  const fetch = vi.fn(serve({}));
  const lib = new POLITELib({ ...credentials, d2lFetchToken: validToken, fetch });

  expect(await lib.brightspace).toBe(await lib.brightspace);
  expect(fetch).not.toHaveBeenCalled();
});

test("brightspace fetches a token on first use when none was given", async () => {
  const fetch = vi.fn(serve(tokenEndpoints));
  const lib = new POLITELib({ ...credentials, fetch });

  const client = await lib.brightspace;

  expect(await lib.brightspace).toBe(client);
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("brightspace fetches a new token once the old one has expired", async () => {
  const lib = new POLITELib({ ...credentials, d2lFetchToken: expiredToken, fetch: serve(tokenEndpoints) });

  const client = await lib.brightspace;

  expect(client.tokenExpiry.epochMilliseconds).toBeGreaterThan(Date.now());
});

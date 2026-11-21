// These run POLITELib against responses recorded from POLITEMall (scrubbed, see ../fixtures), so
// they check our schemas and mapping against what the API really sends, not what we assume it does.
import { UnsecuredJWT } from "jose";
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vite-plus/test";

import { POLITELib } from "./politelib";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));

/** Answers requests by path (with the query string tried first), failing on any request it has no answer for. */
function serve(routes: Record<string, unknown>) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = input as URL;
    const answer = routes[url.pathname + url.search] ?? routes[url.pathname];
    if (answer === undefined) throw new Error(`Unexpected request to ${url.href}`);
    return answer instanceof Response ? answer : Response.json(answer);
  });
}

const lib = new POLITELib({
  d2lSessionVal: "session",
  d2lSecureSessionVal: "secure",
  domain: "nplms",
  d2lFetchToken: new UnsecuredJWT({ tenantid: "tenant-1" })
    .setSubject("user-1")
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .encode(),
});

test("the user and institution are read from their recorded responses", async () => {
  serve({
    "/d2l/api/lp/1.0/users/whoami": fixture("whoami"),
    "/d2l/api/lp/1.46/organization/info": fixture("organization"),
  });

  expect(await lib.getUser()).toEqual({ id: "100001", name: "FirstName 1" });
  expect(await lib.getInstitution()).toEqual({ id: "100002", name: "Name 5" });
});

test("only course offerings are taken from the recorded enrollments", async () => {
  serve({
    "/d2l/api/lp/1.46/enrollments/myenrollments/": {
      ...fixture("enrollments"),
      PagingInfo: { Bookmark: "", HasMoreItems: false },
    },
  });

  expect(await lib.getModules()).toEqual([{ id: "100004", name: "Name 15", code: "Code 16" }]);
});

test("the recorded parent org units parse", async () => {
  serve({ "/d2l/api/lp/1.46/courses/parentorgunits": fixture("parent-org-units") });

  const parents = await lib.polite.getParentOrgUnits({ orgUnitIdsCSV: "100004" });

  expect(parents.map((p) => p.Semester.Identifier)).toEqual(["100006", "100006", "100011"]);
});

test("quizzes are read across recorded pages, including ones with no start, end or due date", async () => {
  serve({
    "/d2l/api/le/1.75/100013/quizzes/": fixture("quizzes-page-1"),
    "/d2l/api/le/1.75/100013/quizzes/?bookmark=bookmark-27": fixture("quizzes-page-2"),
  });

  const quizzes = await lib.getQuizzes({ moduleId: "100013" });

  expect(quizzes.map((q) => [q.id, q.dueAt?.toString() ?? null])).toEqual([
    ["100014", null],
    ["100016", "2024-08-17T15:59:59Z"],
    ["100017", null],
  ]);
});

test("recorded dropbox folders keep a missing due date and availability window as such", async () => {
  serve({ "/d2l/api/le/1.75/m1/dropbox/folders/": fixture("dropbox-folders") });

  const dropboxes = await lib.getSubmissionDropboxes({ moduleId: "m1" });

  expect(
    dropboxes.map((d) => [d.id, d.dueAt?.toString() ?? null, d.opensAt?.toString(), d.closesAt?.toString()]),
  ).toEqual([
    ["100019", "2024-09-12T15:59:59Z", "2024-08-31T16:01:00Z", "2024-09-26T15:59:59Z"],
    ["100020", null, undefined, undefined],
    ["100022", "2025-09-13T15:59:59Z", "2025-09-07T01:00:00Z", "2025-09-20T15:59:59Z"],
  ]);
});

test("recorded submissions are mapped, and a user with none gets an empty list", async () => {
  serve({
    "/d2l/api/le/1.75/m1/dropbox/folders/d1/submissions/": fixture("dropbox-submissions"),
    "/d2l/api/le/1.75/m1/dropbox/folders/d2/submissions/": fixture("dropbox-submissions-none"),
  });

  const submitted = await lib.getSubmissions({ moduleId: "m1", dropboxId: "d1" });

  expect(submitted.map((s) => [s.id, s.submittedAt?.toString()])).toEqual([
    ["100024", "2025-12-08T06:10:13.43Z"],
    ["100026", "2025-12-08T06:11:22.563Z"],
    ["100028", "2025-12-08T07:36:42.563Z"],
  ]);
  expect(await lib.getSubmissions({ moduleId: "m1", dropboxId: "d2" })).toEqual([]);
});

test("a closed dropbox's recorded Brightspace submissions are read when POLITE refuses", async () => {
  serve({
    "/d2l/api/le/1.75/m1/dropbox/folders/d1/submissions/": new Response("", { status: 403 }),
    "/old/activities/org_2000_d1/usages/m1/users/user-1": fixture("closed-dropbox-usage"),
    "/100064/folders/submissions/100066": fixture("closed-dropbox-submission"),
  });

  expect(await lib.getSubmissions({ moduleId: "m1", dropboxId: "d1", organizationId: "org" })).toEqual([
    {
      id: "100066",
      dropboxId: "d1",
      submittedAt: Temporal.Instant.from("2024-08-20T12:04:29.893Z"),
      comment: undefined,
    },
  ]);
});

test("every kind of recorded topic becomes the right activity, folders before their contents", async () => {
  const lookups = fixture("brightspace-lookups");
  const toc = fixture("toc");
  serve({
    "/d2l/api/le/1.75/m1/content/toc": toc,
    "/content/enforced/segment-59/segment-64.html": new Response("<p>Page</p>"),
    "/m1/activity/100035": lookups.activity["100035"],
    "/m1/activity/100038": lookups.activity["100038"],
    "/m1/activity/100056": lookups.activity["100056"],
    "/m1/activity/100060": lookups.activity["100060"],
    "/topics/m1/100055": lookups.thumbnail["100055"],
    "/topics/m1/100055/media": lookups.media["100055"],
  });

  const activities = await lib.getModuleActivities({ moduleId: "m1" });

  expect(activities.map((a) => [a.type, a.id, a.parentId])).toEqual([
    ["folder", "100033", null],
    ["html", "100034", "100033"],
    ["doc_embed", "100035", "100033"],
    ["doc_embed", "100038", "100033"],
    ["submission", "100041", "100033"],
    ["submission", "100043", "100033"],
    ["unknown", "100045", "100033"],
    ["folder", "100048", null],
    ["folder", "100049", "100048"],
    ["folder", "100050", "100049"],
    ["quiz", "100051", "100050"],
    ["folder", "100053", "100048"],
    ["doc_embed", "100056", "100053"],
    ["folder", "100054", "100053"],
    ["video_embed", "100055", "100054"],
    ["folder", "100057", "100048"],
    ["web_embed", "100058", "100057"],
    ["folder", "100059", "100048"],
    ["doc_embed", "100060", "100059"],
  ]);
});

test("a recorded document's converted preview and its expiry are read, and are absent when there is none", async () => {
  const lookups = fixture("brightspace-lookups");
  serve({
    "/d2l/api/le/1.75/m1/content/toc": fixture("toc"),
    "/content/enforced/segment-59/segment-64.html": new Response(""),
    "/m1/activity/100035": lookups.activity["100035"],
    "/m1/activity/100038": lookups.activity["100038"],
    "/m1/activity/100056": lookups.activity["100056"],
    "/m1/activity/100060": lookups.activity["100060"],
    "/topics/m1/100055": lookups.thumbnail["100055"],
    "/topics/m1/100055/media": lookups.media["100055"],
  });

  const docs = (await lib.getModuleActivities({ moduleId: "m1" })).filter((a) => a.type === "doc_embed");

  expect(docs.map((d) => [d.id, d.previewURL !== undefined, d.previewURLExpiry?.toString()])).toEqual([
    ["100035", false, undefined],
    ["100038", true, "2027-01-01T11:39:47Z"],
    ["100056", true, "2027-01-01T11:40:30Z"],
    ["100060", false, undefined],
  ]);
});

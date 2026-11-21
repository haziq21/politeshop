import { UnsecuredJWT } from "jose";
import { expect, test, vi } from "vite-plus/test";

import { Brightspace } from "./brightspace";

const token = new UnsecuredJWT({ tenantid: "tenant-1" }).setSubject("user-1").setExpirationTime(1773810000).encode();

const entity = { class: ["thing"], properties: { a: 1 } };

function mockFetch(...responses: Response[]) {
  const fetch = vi.spyOn(globalThis, "fetch");
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  return fetch;
}

const calledURL = (fetch: ReturnType<typeof mockFetch>) => (fetch.mock.calls[0]![0] as URL).href;

test("the constructor reads the user, tenant and expiry from the token", () => {
  const client = new Brightspace({ d2lFetchToken: token });

  expect(client.userId).toBe("user-1");
  expect(client.tenantId).toBe("tenant-1");
  expect(client.tokenExpiry.epochMilliseconds).toBe(1773810000 * 1000);
});

test("each endpoint is requested from the right tenant API host and path", async () => {
  const client = new Brightspace({ d2lFetchToken: token });
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(entity));

  await client.getActivity({ moduleId: "m1", topicId: 7 });
  await client.getClosedDropboxSubmissions({ orgId: "org", dropboxId: "d1", moduleId: "m1" });
  await client.getTopicThumbnail({ moduleId: "m1", activityId: "a1" });
  await client.getTopicMedia({ moduleId: "m1", activityId: "a1" });

  expect(fetch.mock.calls.map(([url]) => (url as URL).href)).toEqual([
    "https://tenant-1.sequences.api.brightspace.com/m1/activity/7?filterOnDatesAndDepth=0",
    "https://tenant-1.activities.api.brightspace.com/old/activities/org_2000_d1/usages/m1/users/user-1",
    "https://tenant-1.content-service.api.brightspace.com/topics/m1/a1",
    "https://tenant-1.content-service.api.brightspace.com/topics/m1/a1/media",
  ]);
});

test("getSubmissionDetails requests the absolute href unchanged", async () => {
  const fetch = mockFetch(Response.json(entity));

  await new Brightspace({ d2lFetchToken: token }).getSubmissionDetails({
    href: "https://tenant-1.assignments.api.brightspace.com/submissions/77",
  });

  expect(calledURL(fetch)).toBe("https://tenant-1.assignments.api.brightspace.com/submissions/77");
});

test("requests send the token as a bearer credential and the result is parsed as a Siren entity", async () => {
  const fetch = mockFetch(Response.json(entity));

  const result = await new Brightspace({ d2lFetchToken: token }).getTopicMedia({ moduleId: "m", activityId: "a" });

  expect(new Headers(fetch.mock.calls[0]![1]!.headers).get("Authorization")).toBe(`Bearer ${token}`);
  expect(result.properties).toEqual({ a: 1 });
});

test("a JSON error body is included in the error", async () => {
  mockFetch(Response.json({ error: "denied" }, { status: 403 }));

  await expect(
    new Brightspace({ d2lFetchToken: token }).getTopicMedia({ moduleId: "m", activityId: "a" }),
  ).rejects.toThrow(
    'Brightspace API error 403 at https://tenant-1.content-service.api.brightspace.com/topics/m/a/media: {"error":"denied"}',
  );
});

test("a text error body is included in the error", async () => {
  mockFetch(new Response("gateway down", { status: 502 }));

  await expect(
    new Brightspace({ d2lFetchToken: token }).getTopicMedia({ moduleId: "m", activityId: "a" }),
  ).rejects.toThrow("Brightspace API error 502");
});

test("abort cancels in-flight requests", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason))),
  );
  const client = new Brightspace({ d2lFetchToken: token });

  const request = client.getTopicMedia({ moduleId: "m", activityId: "a" });
  client.abort();

  await expect(request).rejects.toThrow("aborted");
});

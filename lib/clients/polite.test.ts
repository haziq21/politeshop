import { expect, test, vi } from "vite-plus/test";
import { ZodError } from "zod";

import { UnexpectedResponseError } from "../errors";
import { POLITE } from "./polite";

const polite = () => new POLITE({ d2lSessionVal: "sess", d2lSecureSessionVal: "secure", domain: "nplms" });

function mockFetch(...responses: Response[]) {
  const fetch = vi.spyOn(globalThis, "fetch");
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  return fetch;
}

const calledURL = (fetch: ReturnType<typeof mockFetch>, call = 0) => (fetch.mock.calls[call]![0] as URL).href;
const calledInit = (fetch: ReturnType<typeof mockFetch>, call = 0) => fetch.mock.calls[call]![1]!;

test("requests resolve paths against the base URL and carry both session cookies", async () => {
  const fetch = mockFetch(
    Response.json({ Identifier: "1", FirstName: "Sam", LastName: "Tan", UniqueName: "s", ProfileIdentifier: "p" }),
  );

  await polite().whoAmI();

  expect(calledURL(fetch)).toBe("https://nplms.polite.edu.sg/d2l/api/lp/1.0/users/whoami");
  expect(new Headers(calledInit(fetch).headers).get("Cookie")).toBe("d2lSessionVal=sess; d2lSecureSessionVal=secure");
});

test("absolute URLs are requested as given", async () => {
  const fetch = mockFetch(Response.json({ Next: null, Objects: [] }));

  await polite().getQuizzesPage({ urlOrPath: "https://other.polite.edu.sg/d2l/api/le/1.75/1/quizzes/?bookmark=2" });

  expect(calledURL(fetch)).toBe("https://other.polite.edu.sg/d2l/api/le/1.75/1/quizzes/?bookmark=2");
});

test("a non-OK response throws an UnexpectedResponseError carrying the response", async () => {
  mockFetch(new Response("nope", { status: 403 }));

  const error = await polite()
    .whoAmI()
    .catch((e) => e);

  expect(error).toBeInstanceOf(UnexpectedResponseError);
  expect(error.message).toBe("Received 403 for https://nplms.polite.edu.sg/d2l/api/lp/1.0/users/whoami");
  expect(error.response.status).toBe(403);
});

test("a body that doesn't match the schema throws a ZodError", async () => {
  mockFetch(Response.json({ Identifier: "1" }));

  await expect(polite().whoAmI()).rejects.toBeInstanceOf(ZodError);
});

test("getMyEnrollments passes an encoded bookmark only when given one", async () => {
  const page = { PagingInfo: { Bookmark: "", HasMoreItems: false }, Items: [] };
  const fetch = mockFetch(Response.json(page), Response.json(page));

  await polite().getMyEnrollments();
  await polite().getMyEnrollments({ bookmark: "a b&c" });

  expect(calledURL(fetch, 0)).toBe("https://nplms.polite.edu.sg/d2l/api/lp/1.46/enrollments/myenrollments/");
  expect(calledURL(fetch, 1)).toBe(
    "https://nplms.polite.edu.sg/d2l/api/lp/1.46/enrollments/myenrollments/?bookmark=a%20b%26c",
  );
});

test("getContentHTML returns the page text and throws on a failed request", async () => {
  mockFetch(new Response("<p>Hi</p>"), new Response("", { status: 404 }));

  expect(await polite().getContentHTML({ urlOrPath: "/content/a.html" })).toBe("<p>Hi</p>");
  await expect(polite().getContentHTML({ urlOrPath: "/content/b.html" })).rejects.toThrow(
    "POLITE API error 404 at /content/b.html",
  );
});

test("getImageURL adds the dimensions only when given", () => {
  expect(polite().getImageURL("9")).toBe("https://nplms.polite.edu.sg/d2l/api/lp/1.46/courses/9/image");
  expect(polite().getImageURL("9", { width: 60, height: 40 })).toBe(
    "https://nplms.polite.edu.sg/d2l/api/lp/1.46/courses/9/image?width=60&height=40",
  );
});

test("getNewFetchToken takes the XSRF token from the homepage and posts it with the token request", async () => {
  const fetch = mockFetch(
    new Response(`<script>localStorage.setItem('XSRF.Token','xsrf-abc');</script>`),
    Response.json({ access_token: "jwt", expires_at: 123 }),
  );

  const token = await polite().getNewFetchToken();

  expect(token).toEqual({ access_token: "jwt", expires_at: 123 });
  expect(calledURL(fetch, 0)).toBe("https://nplms.polite.edu.sg/d2l/home");
  expect(calledURL(fetch, 1)).toBe("https://nplms.polite.edu.sg/d2l/lp/auth/oauth2/token");
  expect(calledInit(fetch, 1).method).toBe("POST");
  expect(new Headers(calledInit(fetch, 1).headers).get("X-Csrf-Token")).toBe("xsrf-abc");
  expect((calledInit(fetch, 1).body as URLSearchParams).toString()).toBe("scope=*%3A*%3A*");
});

test("getNewFetchToken fails clearly when the homepage has no XSRF token", async () => {
  mockFetch(new Response("<html>Please sign in</html>"));

  await expect(polite().getNewFetchToken()).rejects.toThrow("No XSRF token found in homepage");
});

test("abort cancels in-flight requests", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason))),
  );
  const client = polite();

  const request = client.whoAmI();
  client.abort();

  await expect(request).rejects.toThrow("aborted");
});

import { expect, test } from "vite-plus/test";

import { POLITE } from "./polite";

const credentials = { d2lSessionVal: "sess", d2lSecureSessionVal: "secure", domain: "nplms" };
const whoAmI = { Identifier: "1", FirstName: "Sam", LastName: "Tan", UniqueName: "s", ProfileIdentifier: "p" };

test("requests are authenticated with both session cookies", async () => {
  const polite = new POLITE({
    ...credentials,
    fetch: async (_url, init) =>
      new Headers(init?.headers).get("Cookie") === "d2lSessionVal=sess; d2lSecureSessionVal=secure"
        ? Response.json(whoAmI)
        : new Response("", { status: 401 }),
  });

  await expect(polite.whoAmI()).resolves.toMatchObject({ Identifier: "1" });
});

test("getMyEnrollments sends a bookmark containing spaces and & unmangled", async () => {
  const polite = new POLITE({
    ...credentials,
    fetch: async (url) =>
      (url as URL).searchParams.get("bookmark") === "a b&c"
        ? Response.json({ PagingInfo: { Bookmark: "", HasMoreItems: false }, Items: [] })
        : new Response("", { status: 400 }),
  });

  await expect(polite.getMyEnrollments({ bookmark: "a b&c" })).resolves.toMatchObject({ Items: [] });
});

test("getNewFetchToken exchanges the homepage's XSRF token for a Brightspace token", async () => {
  const polite = new POLITE({
    ...credentials,
    fetch: async (url, init) => {
      if ((url as URL).pathname === "/d2l/home") {
        return new Response(`<script>localStorage.setItem('XSRF.Token','xsrf-abc');</script>`);
      }
      return new Headers(init?.headers).get("X-Csrf-Token") === "xsrf-abc"
        ? Response.json({ access_token: "jwt", expires_at: 123 })
        : new Response("", { status: 403 });
    },
  });

  expect(await polite.getNewFetchToken()).toEqual({ access_token: "jwt", expires_at: 123 });
});

test("getNewFetchToken fails clearly when the homepage has no XSRF token", async () => {
  const polite = new POLITE({ ...credentials, fetch: async () => new Response("<html>Please sign in</html>") });

  await expect(polite.getNewFetchToken()).rejects.toThrow("No XSRF token found in homepage");
});

test("getContentHTML doesn't send the session cookies to another host", async () => {
  const polite = new POLITE({
    ...credentials,
    fetch: async (_url, init) => new Response(new Headers(init?.headers).get("Cookie") ?? "no cookie"),
  });

  expect(await polite.getContentHTML({ urlOrPath: "https://evil.example.com/page.html" })).toBe("no cookie");
});

test("aborting the signal cancels in-flight requests", async () => {
  const controller = new AbortController();
  const polite = new POLITE({
    ...credentials,
    signal: controller.signal,
    fetch: (_url, init) =>
      new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason))),
  });

  const request = polite.whoAmI();
  controller.abort();

  await expect(request).rejects.toThrow("aborted");
});

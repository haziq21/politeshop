import { expect, test } from "vite-plus/test";

import { HTTPError } from "../errors";
import { createFetch } from "./fetch";

const baseURL = "https://a.example.com";

test("relative paths are resolved against the base URL", async () => {
  const api = createFetch({ baseURL, headers: {}, fetch: async (url) => new Response((url as URL).href) });

  const res = await api("/path?q=1");

  expect(await res.text()).toBe("https://a.example.com/path?q=1");
});

test("requests carry the default headers along with their own", async () => {
  const api = createFetch({
    baseURL,
    headers: { Authorization: "Bearer abc" },
    fetch: async (_url, init) => Response.json(Object.fromEntries(new Headers(init?.headers))),
  });

  const res = await api("/", { headers: { "X-Extra": "1" } });

  expect(await res.json()).toEqual({ authorization: "Bearer abc", "x-extra": "1" });
});

test("the default headers are only sent to the base URL's origin", async () => {
  const api = createFetch({
    baseURL,
    headers: { Cookie: "secret" },
    fetch: async (_url, init) => new Response(new Headers(init?.headers).get("Cookie") ?? "none"),
  });

  expect(await (await api("/")).text()).toBe("secret");
  expect(await (await api("https://a.example.com/other")).text()).toBe("secret");
  expect(await (await api("https://evil.example.com/steal")).text()).toBe("none");
  expect(await (await api("//evil.example.com/steal")).text()).toBe("none");
  expect(await (await api("http://a.example.com/downgraded")).text()).toBe("none");
});

test("a Request keeps its own method and headers, and gets the default headers", async () => {
  const api = createFetch({
    baseURL,
    headers: { Cookie: "secret" },
    fetch: async (input, init) => {
      const sent = new Request(input, init);
      return Response.json({ method: sent.method, headers: Object.fromEntries(sent.headers) });
    },
  });

  const res = await api(new Request("https://a.example.com/x", { method: "POST", headers: { "X-Own": "1" } }));

  expect(await res.json()).toEqual({ method: "POST", headers: { cookie: "secret", "x-own": "1" } });
});

test("init replaces a Request's own headers and signal, as in fetch", async () => {
  const api = createFetch({
    baseURL,
    headers: { Cookie: "secret" },
    fetch: async (input, init) => {
      init?.signal?.throwIfAborted();
      return Response.json(Object.fromEntries(new Request(input, init).headers));
    },
  });
  const request = new Request("https://a.example.com/x", { headers: { "X-Own": "1" }, signal: AbortSignal.abort() });

  const res = await api(request, { headers: { "X-Init": "2" }, signal: new AbortController().signal });

  expect(await res.json()).toEqual({ cookie: "secret", "x-init": "2" });
});

test("a failed response throws an HTTPError with its status and URL", async () => {
  const api = createFetch({ baseURL, headers: {}, fetch: async () => new Response("nope", { status: 502 }) });

  const error = await api("/x").catch((e) => e);

  expect(error).toBeInstanceOf(HTTPError);
  expect(error.status).toBe(502);
  expect(error.message).toBe("Received 502 for https://a.example.com/x");
});

test("aborting the client's signal cancels in-flight requests", async () => {
  const controller = new AbortController();
  const api = createFetch({
    baseURL,
    headers: {},
    signal: controller.signal,
    fetch: (_url, init) =>
      new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason))),
  });

  const request = api("/x");
  controller.abort();

  await expect(request).rejects.toThrow("aborted");
});

test("aborting the signal passed with a single request cancels it too", async () => {
  const controller = new AbortController();
  const api = createFetch({
    baseURL,
    headers: {},
    fetch: (_url, init) =>
      new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason))),
  });

  const request = api("/x", { signal: controller.signal });
  controller.abort();

  await expect(request).rejects.toThrow("aborted");
});

import { UnsecuredJWT } from "jose";
import { expect, test } from "vite-plus/test";

import { Brightspace } from "./brightspace";

const expiresAt = Temporal.Instant.from("2026-03-18T05:00:00Z");
const token = new UnsecuredJWT({ tenantid: "tenant-1" })
  .setSubject("user-1")
  .setExpirationTime(expiresAt.epochMilliseconds / 1000)
  .encode();

test("the user, tenant and token expiry are read from the token", () => {
  const brightspace = new Brightspace({ d2lFetchToken: token });

  expect(brightspace.userId).toBe("user-1");
  expect(brightspace.tenantId).toBe("tenant-1");
  expect(brightspace.tokenExpiry).toEqual(expiresAt);
});

test("requests are authenticated with the token, and the response is parsed as a Siren entity", async () => {
  const brightspace = new Brightspace({
    d2lFetchToken: token,
    fetch: async (_url, init) =>
      new Headers(init?.headers).get("Authorization") === `Bearer ${token}`
        ? Response.json({ class: ["media"], properties: { src: "https://example.com/v.mp4" } })
        : new Response("", { status: 401 }),
  });

  const media = await brightspace.getTopicMedia({ moduleId: "m", activityId: "a" });

  expect(media.properties).toEqual({ src: "https://example.com/v.mp4" });
});

test("a failed request throws with the status and the response body", async () => {
  const brightspace = new Brightspace({
    d2lFetchToken: token,
    fetch: async () => Response.json({ error: "denied" }, { status: 403 }),
  });

  await expect(brightspace.getTopicMedia({ moduleId: "m", activityId: "a" })).rejects.toThrow(
    /Brightspace API error 403 .*\{"error":"denied"\}/,
  );
});

test("abort cancels in-flight requests", async () => {
  const brightspace = new Brightspace({
    d2lFetchToken: token,
    fetch: (_url, init) =>
      new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason))),
  });

  const request = brightspace.getTopicMedia({ moduleId: "m", activityId: "a" });
  brightspace.abort();

  await expect(request).rejects.toThrow("aborted");
});

import { UnsecuredJWT } from "jose";
import { expect, test } from "vite-plus/test";

import { Brightspace } from "./brightspace";

const expiresAt = Temporal.Instant.from("2026-03-18T05:00:00Z");
const token = new UnsecuredJWT({ tenantid: "11111111-1111-4111-8111-111111111111" })
  .setSubject("12345")
  .setExpirationTime(expiresAt.epochMilliseconds / 1000)
  .encode();

test("the user, tenant and token expiry are read from the token", () => {
  const brightspace = new Brightspace({ d2lFetchToken: token });

  expect(brightspace.userId).toBe("12345");
  expect(brightspace.tenantId).toBe("11111111-1111-4111-8111-111111111111");
  expect(brightspace.tokenExpiry).toEqual(expiresAt);
});

test("a token whose tenant or user could redirect requests is rejected", () => {
  const forge = (claims: { tenantid: string; sub: string }) =>
    new UnsecuredJWT({ tenantid: claims.tenantid }).setSubject(claims.sub).setExpirationTime("1h").encode();

  expect(() => new Brightspace({ d2lFetchToken: forge({ tenantid: "169.254.169.254/#", sub: "1" }) })).toThrow();
  expect(
    () => new Brightspace({ d2lFetchToken: forge({ tenantid: "11111111-1111-4111-8111-111111111111", sub: "../x" }) }),
  ).toThrow();
  expect(
    () => new Brightspace({ d2lFetchToken: forge({ tenantid: "11111111-1111-4111-8111-111111111111", sub: "abc" }) }),
  ).toThrow();
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

test("each API is requested from its own host on the tenant", async () => {
  const hosts: string[] = [];
  const brightspace = new Brightspace({
    d2lFetchToken: token,
    fetch: async (url) => {
      hosts.push((url as URL).host);
      return Response.json({ class: [] });
    },
  });

  await brightspace.getActivity({ moduleId: "m", topicId: 1 });
  await brightspace.getClosedDropboxSubmissions({ orgId: "o", dropboxId: "d", moduleId: "m" });
  await brightspace.getTopicThumbnail({ moduleId: "m", activityId: "a" });
  await brightspace.getTopicMedia({ moduleId: "m", activityId: "a" });

  expect(hosts).toEqual([
    "11111111-1111-4111-8111-111111111111.sequences.api.brightspace.com",
    "11111111-1111-4111-8111-111111111111.activities.api.brightspace.com",
    "11111111-1111-4111-8111-111111111111.content-service.api.brightspace.com",
    "11111111-1111-4111-8111-111111111111.content-service.api.brightspace.com",
  ]);
});

test("getSubmissionDetails only sends the token to the tenant's assignments API", async () => {
  const brightspace = new Brightspace({
    d2lFetchToken: token,
    fetch: async (_url, init) =>
      Response.json({ class: [], properties: { authorization: new Headers(init?.headers).get("Authorization") } }),
  });

  const own = await brightspace.getSubmissionDetails({
    href: "https://11111111-1111-4111-8111-111111111111.assignments.api.brightspace.com/submissions/1",
  });
  const elsewhere = await brightspace.getSubmissionDetails({ href: "https://evil.example.com/submissions/1" });
  const otherTenant = await brightspace.getSubmissionDetails({
    href: "https://22222222-2222-4222-8222-222222222222.assignments.api.brightspace.com/submissions/1",
  });

  expect(own.properties?.authorization).toBe(`Bearer ${token}`);
  expect(elsewhere.properties?.authorization).toBeNull();
  expect(otherTenant.properties?.authorization).toBeNull();
});

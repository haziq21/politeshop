import { expect, test } from "@playwright/test";

// These hit the SvelteKit server directly (no extension / browser needed) —
// they exercise `hooks.server.ts`'s auth guard, which runs before anything
// extension- or POLITELib-related.

test("requests without POLITEMall session headers are rejected", async ({ request }) => {
  const res = await request.get("/d2l/home");
  expect(res.status()).toBe(401);
  expect(await res.text()).toContain("Missing credentials");
});

test("/d2l/login is exempt from the credential check", async ({ request }) => {
  const res = await request.get("/d2l/login");
  expect(res.status()).toBe(200);
});

import { expect, test } from "./fixtures";

test("missing session headers rejected", async ({ request }) => {
  const res = await request.get("/d2l/home");
  expect(res.status()).toBe(401);
  expect(await res.text()).toContain("Missing credentials");
});

test("login page exempt from credential check", async ({ request }) => {
  const res = await request.get("/d2l/login");
  expect(res.status()).toBe(200);
});

test("expired session redirects to POLITEMall login", async ({ mw, page }) => {
  await mw("pl.getUser").mockRejectedValue(new Error("session expired"));

  await page.goto("/d2l/home");

  await expect(page).toHaveURL("/sso/login?sessionExpired=1&target=%2Fd2l%2Fhome");
});

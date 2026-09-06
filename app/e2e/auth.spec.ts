import { expect, test } from "./fixtures";
import { mockPoliteMall } from "./politemall-mock";

test("missing session headers rejected", async ({ request }) => {
  const res = await request.get("/d2l/home");
  expect(res.status()).toBe(401);
  expect(await res.text()).toContain("Missing credentials");
});

test("login page exempt from credential check", async ({ request }) => {
  const res = await request.get("/d2l/login");
  expect(res.status()).toBe(200);
});

test("expired session redirects to POLITEMall login", async ({ page }) => {
  const { origin } = await mockPoliteMall(page.context(), { subdomain: "testlms", sessionExpired: true });

  await page.goto(`${origin}/d2l/home`);

  await expect(page).toHaveURL(`${origin}/sso/login?sessionExpired=1&target=%2Fd2l%2Fhome`);
});

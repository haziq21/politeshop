import { resetData, seedData } from "./db";
import { expect, test } from "./fixtures";
import { mockPoliteMall } from "./politemall-mock";

const SUBDOMAIN = "testlms";

test.afterEach(() => resetData(SUBDOMAIN));

test("iframe renders synced data for returning user", async ({ page }) => {
  const { origin, d2lSessionVal, d2lSecureSessionVal } = await mockPoliteMall(page.context(), {
    subdomain: SUBDOMAIN,
  });
  await seedData(SUBDOMAIN, { d2lSessionVal, d2lSecureSessionVal });

  await page.goto(`${origin}/d2l/home`);

  await expect(page.locator("iframe")).toHaveCount(1);

  const app = page.frameLocator("iframe");
  await expect(app.getByRole("heading", { name: "Test Polytechnic" })).toBeVisible();
  await expect(app.getByText("IT101")).toBeVisible();
  await expect(app.getByText("Introduction to Testing")).toBeVisible();
});

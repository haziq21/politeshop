import { expect, test } from "./fixtures";

test("iframe renders synced data for returning user", async ({ page, seededUser }) => {
  await page.goto("/d2l/home");

  await expect(page.locator("iframe")).toHaveCount(1);

  const app = page.frameLocator("iframe");
  await expect(app.getByRole("heading", { name: seededUser.institution.name })).toBeVisible();
  await expect(app.getByText(seededUser.module.code)).toBeVisible();
  await expect(app.getByText(seededUser.module.name)).toBeVisible();
});

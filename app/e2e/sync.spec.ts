import { expect, test } from "./fixtures";

test("iframe renders synced data for returning user", async ({ page, mocks: { data } }) => {
  await page.goto("/d2l/home");

  await expect(page.locator("iframe")).toHaveCount(1);

  const app = page.frameLocator("iframe");
  await expect(app.getByRole("heading", { name: data.institution.name })).toBeVisible();
  await expect(app.getByText(data.module.code)).toBeVisible();
  await expect(app.getByText(data.module.name)).toBeVisible();
});

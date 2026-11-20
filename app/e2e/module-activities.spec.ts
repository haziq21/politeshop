import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
});

test("syncing a module shows nested folders in the sidebar", async ({ mw, page, mocks: { data, pl } }) => {
  const app = page.frameLocator("iframe");
  const week1 = app.getByRole("button", { name: "Week 1" });
  await mw("pl.getModuleActivities").mockRejectedValue(new Error("offline"));

  // Nothing is stored until a sync succeeds
  await page.goto(`/d2l/home/${data.module.id}`);
  await expect(app.getByRole("heading", { name: data.module.name })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(week1).toHaveCount(0);

  await mw("pl.getModuleActivities").mockResolvedValue(pl.activities);
  await page.reload();

  await week1.click();
  await expect(app.getByRole("link", { name: "🧑‍🏫 Introduction", exact: true })).toBeVisible();
  await app.getByRole("button", { name: "Readings" }).click();
  await expect(app.getByRole("link", { name: "Reference site" })).toBeVisible();
  await expect(app.getByRole("link", { name: "Quiz B" })).toBeVisible();
});

test("the stored activities render when a fresh sync fails", async ({ mw, page, mocks: { data } }) => {
  await page.goto(`/d2l/home/${data.module.id}`);
  const app = page.frameLocator("iframe");
  await expect(app.getByRole("button", { name: "Week 1" })).toBeVisible();
  await expect(app.getByRole("button", { name: "Week 2" })).toBeVisible();

  await mw("pl.getModuleActivities").mockRejectedValue(new Error("offline"));
  await page.reload();

  await expect(app.getByRole("button", { name: "Week 1" })).toBeVisible();
  await expect(app.getByRole("button", { name: "Week 2" })).toBeVisible();
});

test("an activity the user can't access is not found", async ({ page, mocks: { data } }) => {
  await page.goto(`/d2l/home/${data.module.id}/activity/${data.hiddenActivity.id}`);
  const app = page.frameLocator("iframe");

  await expect(app.getByText(`Activity ${data.hiddenActivity.id} not found`)).toBeVisible();
  await expect(app.getByRole("navigation", { name: "breadcrumb" })).toHaveCount(0);
});

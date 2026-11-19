import type { FrameLocator, Page } from "@playwright/test";

import { eq } from "drizzle-orm";

import * as schema from "../src/lib/server/db/schema";
import { db } from "./db";
import { expect, test as base } from "./fixtures";

// Every test here needs the seeded rows, though most never read the returned data
const test = base.extend<{ _seed: void }>({
  _seed: [async ({ seededUser: _seededUser }, use) => use(), { auto: true }],
});

const openHome = async (page: Page) => {
  await page.goto("/d2l/home");
  return page.frameLocator("iframe");
};
const day = (app: FrameLocator, date: string) => app.locator(`[data-date="${date}"]`);
const listed = (app: FrameLocator) => app.getByRole("region", { name: "Upcoming deadlines" }).getByRole("listitem");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime("2026-03-18T10:00:00Z");
  await page.setViewportSize({ width: 1600, height: 900 });
});

test("lists what's due in the next 14 days, soonest first, with submission counts", async ({ page }) => {
  const app = await openHome(page);

  await expect(app.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
  const items = listed(app);
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Report A");
  await expect(items.nth(1)).toContainText("Quiz B");
  await expect(items.nth(2)).toContainText("Draft C");
  await expect(items.nth(0).getByLabel("2 submissions")).toBeVisible();
  await expect(items.nth(1).getByLabel(/submission/)).toHaveCount(0);
});

test("hovering a day previews its items, and leaving restores the list", async ({ page }) => {
  const app = await openHome(page);

  await day(app, "2026-03-21").hover();
  await expect(app.getByRole("heading", { name: "Saturday 21 Mar" })).toBeVisible();
  await expect(listed(app)).toHaveCount(1);
  await expect(listed(app).first()).toContainText("Quiz B");

  await app.getByRole("heading", { level: 2 }).hover();
  await expect(app.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
  await expect(listed(app)).toHaveCount(3);
});

test("clicking a day pins it, and clicking it again clears it", async ({ page }) => {
  const app = await openHome(page);

  await day(app, "2026-03-21").click();
  await expect(day(app, "2026-03-21")).toHaveAttribute("aria-pressed", "true");
  await app.getByRole("heading", { level: 2 }).hover();
  await expect(app.getByRole("heading", { name: "Saturday 21 Mar" })).toBeVisible();

  await day(app, "2026-03-21").click();
  await app.getByRole("heading", { level: 2 }).hover();
  await expect(day(app, "2026-03-21")).toHaveAttribute("aria-pressed", "false");
  await expect(app.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
});

test("arrow keys move the selection between days", async ({ page }) => {
  const app = await openHome(page);

  await day(app, "2026-03-18").focus();
  await page.keyboard.press("ArrowRight");
  await expect(app.getByRole("heading", { name: "Thursday 19 Mar" })).toBeVisible();
  await expect(listed(app).first()).toContainText("Report A");
  await expect(day(app, "2026-03-19")).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(app.getByRole("heading", { name: "Thursday 26 Mar" })).toBeVisible();
  await expect(app.getByText("Nothing due", { exact: true })).toBeVisible();
});

test("nav buttons page the heatmap by half its window, even when pressed before the slide lands", async ({ page }) => {
  const app = await openHome(page);
  const days = app.getByRole("group", { name: "Days" }).locator("[data-date]");

  const later = app.getByRole("button", { name: "Later" });
  await later.click();
  await later.click();
  await later.click();
  await expect(days.first()).toHaveAttribute("data-date", "2026-09-07");
  await expect(days).toHaveCount(140);

  const earlier = app.getByRole("button", { name: "Earlier" });
  await earlier.click();
  await earlier.click();
  await earlier.click();
  await expect(day(app, "2026-03-18")).toBeVisible();
});

test("keyboard navigation past the edge of the view pages like the nav buttons", async ({ page }) => {
  const app = await openHome(page);

  // 2026-06-24 is on the last week in view
  await day(app, "2026-06-24").focus();
  await page.keyboard.press("ArrowDown");

  await expect(day(app, "2026-07-01")).toBeFocused();
  await expect(app.getByRole("group", { name: "Days" }).locator("[data-date]").first()).toHaveAttribute(
    "data-date",
    "2026-04-20",
  );
});

test("keeps a day tabbable when the selected day has scrolled out of view", async ({ page }) => {
  const app = await openHome(page);

  await day(app, "2026-03-19").click();
  const later = app.getByRole("button", { name: "Later" });
  await later.click();
  await later.click();
  await later.click();
  await expect(day(app, "2026-03-19")).toHaveCount(0);

  await expect(app.getByRole("group", { name: "Days" }).locator('[data-date][tabindex="0"]')).toHaveCount(1);
});

test("says nothing is due soon when every deadline has passed", async ({ page }) => {
  await page.clock.setFixedTime("2026-05-01T10:00:00Z");
  const app = await openHome(page);

  await expect(app.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
  await expect(app.getByText("Nothing due soon")).toBeVisible();
});

test("is hidden when there are no due dates at all", async ({ page, seededUser }) => {
  await db.delete(schema.quiz).where(eq(schema.quiz.moduleId, seededUser.module.id));
  await db.delete(schema.submissionDropbox).where(eq(schema.submissionDropbox.moduleId, seededUser.module.id));
  const app = await openHome(page);

  await expect(app.getByRole("heading", { name: seededUser.institution.name })).toBeVisible();
  await expect(app.getByRole("region", { name: "Upcoming deadlines" })).toHaveCount(0);
});

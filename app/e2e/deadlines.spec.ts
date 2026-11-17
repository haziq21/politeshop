import type { FrameLocator, Page } from "@playwright/test";

import { addDays, setHours, startOfDay, startOfWeek } from "date-fns";

import { dayKey, dayTitle } from "../src/lib/dates";
import { seedDueItems } from "./db";
import { expect, test } from "./fixtures";

type SeededUser = Parameters<typeof seedDueItems>[0];
type DueItemSeed = Parameters<typeof seedDueItems>[1][number];

const NOW = new Date(2026, 2, 18, 10);
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;
const NARROW = 1280;
const WIDE = 1600;
const UPCOMING_DAYS = 14;
const WEEKS = 20;
const PAST_WEEKS = 5;
const STEP = WEEKS / 2;
const CELLS_IN_VIEW = WEEKS * 7;

const noon = (daysFromToday: number) => setHours(startOfDay(addDays(NOW, daysFromToday)), 12);
const quizDue = (daysFromToday: number): DueItemSeed => ({ kind: "quiz", name: "Quiz B", dueAt: noon(daysFromToday) });
const title = (daysFromToday: number) => dayTitle(addDays(NOW, daysFromToday), NOW);

async function open(page: Page, user: SeededUser, items = [quizDue(1)]) {
  await seedDueItems(user, items);
  await page.goto("/d2l/home");
  return page.frameLocator("iframe");
}

const cell = (app: FrameLocator, daysFromToday: number) =>
  app.locator(`[data-date="${dayKey(addDays(NOW, daysFromToday))}"]`);
const daysIn = (app: FrameLocator) => app.getByRole("group", { name: "Days" }).locator("[data-date]");
const list = (app: FrameLocator) => app.getByRole("region", { name: "Upcoming deadlines" }).getByRole("listitem");

test.describe("deadlines", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await page.setViewportSize({ width: WIDE, height: 900 });
  });

  test("lists what's due in the next 14 days, soonest first, with submission counts", async ({ page, seededUser }) => {
    const app = await open(page, seededUser, [
      quizDue(3),
      { kind: "submission", name: "Report A", dueAt: noon(1), submissions: 2 },
      { kind: "submission", name: "Draft C", dueAt: noon(5) },
      { kind: "submission", name: "Too far away", dueAt: noon(UPCOMING_DAYS + 6) },
      { kind: "submission", name: "Long gone", dueAt: noon(-3) },
    ]);

    await expect(app.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
    const items = list(app);
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("Report A");
    await expect(items.nth(1)).toContainText("Quiz B");
    await expect(items.nth(2)).toContainText("Draft C");

    await expect(items.nth(0).getByLabel("2 submissions")).toBeVisible();
    await expect(items.nth(1).getByLabel(/submission/)).toHaveCount(0);
  });

  test("hovering a day previews its items, and leaving restores the list", async ({ page, seededUser }) => {
    const app = await open(page, seededUser, [quizDue(3), { kind: "submission", name: "Report A", dueAt: noon(1) }]);

    await cell(app, 3).hover();
    await expect(app.getByRole("heading", { name: title(3) })).toBeVisible();
    await expect(list(app)).toHaveCount(1);
    await expect(list(app).first()).toContainText("Quiz B");

    await app.getByRole("heading", { level: 2 }).hover();
    await expect(app.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
    await expect(list(app)).toHaveCount(2);
  });

  test("clicking a day pins it, and clicking it again clears it", async ({ page, seededUser }) => {
    const app = await open(page, seededUser, [quizDue(3)]);

    await cell(app, 3).click();
    await expect(cell(app, 3)).toHaveAttribute("aria-pressed", "true");

    await app.getByRole("heading", { level: 2 }).hover();
    await expect(app.getByRole("heading", { name: title(3) })).toBeVisible();

    await cell(app, 3).click();
    await app.getByRole("heading", { level: 2 }).hover();
    await expect(cell(app, 3)).toHaveAttribute("aria-pressed", "false");
    await expect(app.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
  });

  test("arrow keys move the selection between days", async ({ page, seededUser }) => {
    const app = await open(page, seededUser);

    await cell(app, 0).focus();
    await page.keyboard.press("ArrowRight");
    await expect(app.getByRole("heading", { name: title(1) })).toBeVisible();
    await expect(app.getByRole("listitem").filter({ hasText: "Quiz B" })).toBeVisible();
    await expect(cell(app, 1)).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(app.getByRole("heading", { name: title(8) })).toBeVisible();
    await expect(app.getByText("Nothing due", { exact: true })).toBeVisible();
  });

  test("nav buttons slide the heatmap by half its window, even when pressed before the slide lands", async ({
    page,
    seededUser,
  }) => {
    const app = await open(page, seededUser);
    const later = app.getByRole("button", { name: "Later" });

    await later.click();
    await later.click();
    await later.click();
    const firstWeek = -PAST_WEEKS + 3 * STEP;
    await expect(daysIn(app).first()).toHaveAttribute(
      "data-date",
      dayKey(addDays(startOfWeek(NOW, WEEK_OPTIONS), 7 * firstWeek)),
    );
    await expect(daysIn(app)).toHaveCount(CELLS_IN_VIEW);

    const earlier = app.getByRole("button", { name: "Earlier" });
    await earlier.click();
    await earlier.click();
    await earlier.click();
    await expect(cell(app, 0)).toBeVisible();
  });

  test("slides without animating when reduced motion is preferred", async ({ page, seededUser }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const app = await open(page, seededUser);

    await app.getByRole("button", { name: "Later" }).click();
    const firstWeek = addDays(startOfWeek(NOW, WEEK_OPTIONS), 7 * (-PAST_WEEKS + STEP));
    await expect(daysIn(app)).toHaveCount(CELLS_IN_VIEW);
    await expect(daysIn(app).first()).toHaveAttribute("data-date", dayKey(firstWeek));
  });

  test("month labels follow their weeks in and out of view while sliding", async ({ page, seededUser }) => {
    const app = await open(page, seededUser);
    // Hold the slide so it can be sampled at fixed points
    await app.locator("body").evaluate(() => {
      const style = document.createElement("style");
      style.textContent = ".heatmap { transition-duration: 1h !important }";
      document.head.append(style);
    });
    await app.getByRole("button", { name: "Later" }).click();

    const result = await app.locator("html").evaluate(async (_, weeks) => {
      const heatmap = document.querySelector(".heatmap")!;
      const slide = document
        .getAnimations()
        .find((a) => a instanceof CSSTransition && a.transitionProperty === "--view-start")!;
      slide.pause();
      const duration = slide.effect!.getComputedTiming().duration as number;

      let shown = 0;
      let hidden = 0;
      const wrong: string[] = [];
      for (let i = 0; i < 40; i++) {
        slide.currentTime = (duration * i) / 40;
        const pos = Number(getComputedStyle(heatmap).getPropertyValue("--view-start"));
        for (const label of document.querySelectorAll<HTMLElement>("[data-month]")) {
          const rel = Number(label.style.getPropertyValue("--week-index")) - pos;
          if (Math.min(Math.abs(rel + 0.5), Math.abs(rel - (weeks - 0.5))) < 0.01) continue;
          const expected = rel > -0.5 && rel < weeks - 0.5;
          const actual = Number(getComputedStyle(label).opacity) === 1;
          if (actual) shown++;
          else hidden++;
          if (actual !== expected) wrong.push(`${label.textContent} at ${rel.toFixed(2)}: ${actual}`);
        }
      }
      return { shown, hidden, wrong };
    }, WEEKS);

    expect(result.wrong).toEqual([]);
    expect(result.shown).toBeGreaterThan(0);
    expect(result.hidden).toBeGreaterThan(0);
  });

  test("says nothing is due soon when the only deadlines are further away", async ({ page, seededUser }) => {
    const app = await open(page, seededUser, [quizDue(30)]);

    await expect(app.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
    await expect(app.getByText("Nothing due soon")).toBeVisible();
  });

  test("is hidden when there are no due dates at all", async ({ page, seededUser }) => {
    const app = await open(page, seededUser, []);

    await expect(app.getByRole("heading", { name: seededUser.institution.name })).toBeVisible();
    await expect(app.getByRole("region", { name: "Upcoming deadlines" })).toHaveCount(0);
  });

  test("puts the heatmap beside the list when there is room, and above it when there isn't", async ({
    page,
    seededUser,
  }) => {
    const app = await open(page, seededUser);
    const box = async () => ({
      nav: (await app.getByRole("button", { name: "Later" }).boundingBox())!,
      grid: (await app.getByRole("group", { name: "Days" }).boundingBox())!,
      heading: (await app.getByRole("heading", { level: 2 }).boundingBox())!,
    });

    const wide = await box();
    expect(wide.nav.width).toBeGreaterThan(wide.nav.height);
    expect(wide.heading.x + wide.heading.width).toBeLessThan(wide.grid.x);

    await page.setViewportSize({ width: NARROW, height: 900 });
    const narrow = await box();
    expect(narrow.nav.height).toBeGreaterThan(narrow.nav.width);
    expect(narrow.heading.y).toBeGreaterThan(narrow.grid.y + narrow.grid.height);
  });

  test("moves a day with up and down and a week with left and right in the horizontal heatmap", async ({
    page,
    seededUser,
  }) => {
    await page.setViewportSize({ width: NARROW, height: 900 });
    const app = await open(page, seededUser);

    await cell(app, 0).focus();
    await page.keyboard.press("ArrowDown");
    await expect(app.getByRole("heading", { name: title(1) })).toBeVisible();
    await expect(cell(app, 1)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(app.getByRole("heading", { name: title(8) })).toBeVisible();
  });

  test("keeps its window, selection and focus when the layout switches orientation", async ({ page, seededUser }) => {
    const app = await open(page, seededUser);

    await app.getByRole("button", { name: "Later" }).click();
    await expect(cell(app, 1)).toHaveCount(0);
    await expect(daysIn(app)).toHaveCount(CELLS_IN_VIEW);
    const day = daysIn(app).nth(30);
    const key = (await day.getAttribute("data-date"))!;
    await day.click();
    await expect(day).toBeFocused();

    for (const width of [NARROW, WIDE]) {
      await page.setViewportSize({ width, height: 900 });
      const same = app.locator(`[data-date="${key}"]`);
      await expect(same).toHaveAttribute("aria-pressed", "true");
      await expect(same).toBeFocused();
      await expect(cell(app, 1)).toHaveCount(0);
    }
  });

  test("keyboard navigation past the edge pages like the nav buttons", async ({ page, seededUser }) => {
    const app = await open(page, seededUser);

    await cell(app, 0).focus();
    // The view shows weeks -5..14, so week 15 is the first one past the edge
    for (let week = 1; week <= WEEKS - PAST_WEEKS; week++) {
      await page.keyboard.press("ArrowDown");
      await expect(cell(app, week * 7)).toBeFocused();
    }

    const first = dayKey(startOfWeek(addDays(NOW, STEP * 7 - PAST_WEEKS * 7), WEEK_OPTIONS));
    await expect(daysIn(app).first()).toHaveAttribute("data-date", first);
  });

  test("keeps a day tabbable when the selected day has scrolled out of view", async ({ page, seededUser }) => {
    const app = await open(page, seededUser);
    const later = app.getByRole("button", { name: "Later" });

    await cell(app, 1).click();
    await later.click();
    await later.click();
    await later.click();
    await expect(cell(app, 1)).toHaveCount(0);

    await expect(app.getByRole("group", { name: "Days" }).locator('[data-date][tabindex="0"]')).toHaveCount(1);
  });
});

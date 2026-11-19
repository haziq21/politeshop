import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";

import type { DeadlineItem } from "#lib/deadlines.ts";

import UpcomingDeadlines from "./upcoming-deadlines.svelte";

// Deliberately unsorted
const items: DeadlineItem[] = [
  {
    type: "quiz",
    id: 2,
    name: "Quiz D",
    moduleCode: "ABC101",
    dueAt: Temporal.ZonedDateTime.from("2026-04-20T10:00[UTC]"),
    submissionCount: 0,
  },
  {
    type: "submission",
    id: 1,
    name: "Report A",
    moduleCode: "ABC101",
    dueAt: Temporal.ZonedDateTime.from("2026-03-19T09:00[UTC]"),
    submissionCount: 2,
  },
  {
    type: "submission",
    id: 2,
    name: "Draft C",
    moduleCode: "ABC101",
    dueAt: Temporal.ZonedDateTime.from("2026-03-30T23:59[UTC]"),
    submissionCount: 1,
  },
  {
    type: "quiz",
    id: 1,
    name: "Quiz B",
    moduleCode: "ABC101",
    dueAt: Temporal.ZonedDateTime.from("2026-03-21T14:30[UTC]"),
    submissionCount: 0,
  },
];
const today = Temporal.PlainDate.from("2026-03-18");

test("lists what's due in the next 14 days, soonest first, with submission counts", async () => {
  const screen = await render(UpcomingDeadlines, { props: { items, today } });
  const rows = screen.getByRole("listitem");

  await expect.element(screen.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
  await expect.element(rows).toHaveLength(3);
  await expect.element(rows.nth(0)).toMatchTextContent("Report A");
  await expect.element(rows.nth(1)).toMatchTextContent("Quiz B");
  await expect.element(rows.nth(2)).toMatchTextContent("Draft C");
  await expect.element(rows.nth(0).getByLabelText("2 submissions")).toBeVisible();
  await expect.element(rows.nth(1).getByLabelText(/submission/)).not.toBeInTheDocument();
});

test("the default window length is configurable", async () => {
  const screen = await render(UpcomingDeadlines, { props: { items, today, defaultWindowDays: 5 } });

  await expect.element(screen.getByRole("heading", { name: "Next 5 days" })).toBeVisible();
  await expect.element(screen.getByRole("listitem")).toHaveLength(2);
});

test("gives the heatmap each day's deadline count", async () => {
  const screen = await render(UpcomingDeadlines, { props: { items, today } });

  await expect.element(screen.getByRole("button", { name: "Saturday 21 Mar, 1 due" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Friday 20 Mar, nothing due" })).toBeVisible();
});

test("hovering a day previews its items, and leaving restores the list", async () => {
  const screen = await render(UpcomingDeadlines, { props: { items, today } });
  const rows = screen.getByRole("listitem");
  const heading = screen.getByRole("heading", { name: "Saturday 21 Mar" });

  await screen.getByRole("button", { name: /^Saturday 21 Mar,/ }).hover();
  await expect.element(heading).toBeVisible();
  await expect.element(rows).toHaveLength(1);
  await expect.element(rows.first()).toMatchTextContent("Quiz B");

  await heading.hover();
  await expect.element(screen.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
  await expect.element(rows).toHaveLength(3);
});

test("a day with nothing due says so", async () => {
  const screen = await render(UpcomingDeadlines, { props: { items, today } });

  await screen.getByRole("button", { name: /^Sunday 22 Mar,/ }).hover();
  await expect.element(screen.getByRole("heading", { name: "Sunday 22 Mar" })).toBeVisible();
  await expect.element(screen.getByText("Nothing due", { exact: true })).toBeVisible();
});

test("a pinned day stays listed after the pointer leaves, until it is unpinned", async () => {
  const screen = await render(UpcomingDeadlines, { props: { items, today } });
  const saturday = screen.getByRole("button", { name: /^Saturday 21 Mar,/ });
  const heading = screen.getByRole("heading", { name: "Saturday 21 Mar" });

  await saturday.click();
  await heading.hover();
  await expect.element(heading).toBeVisible();

  await saturday.click();
  await heading.hover();
  await expect.element(screen.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
});

test("says nothing is due soon when every deadline has passed", async () => {
  const screen = await render(UpcomingDeadlines, {
    props: { items, today: Temporal.PlainDate.from("2026-05-01") },
  });

  await expect.element(screen.getByRole("heading", { name: "Next 14 days" })).toBeVisible();
  await expect.element(screen.getByText("Nothing due soon")).toBeVisible();
});

import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";

import CalendarHeatmap from "./calendar-heatmap.svelte";

// The heatmap's layout classes query the nearest ancestor container, which its parent provides
document.body.classList.add("@container");

// Wed 18 Mar 2026: the view starts Mon 9 Feb and runs 20 weeks
function props() {
  const state = $state({
    countFor: (date: Temporal.PlainDate) => (date.toString() === "2026-03-19" ? 2 : 0),
    today: Temporal.PlainDate.from("2026-03-18"),
    selectedDate: null as Temporal.PlainDate | null,
    hoveredDate: null as Temporal.PlainDate | null,
  });
  return state;
}

test("nav buttons page by half the window, even when pressed before the slide lands", async () => {
  const screen = await render(CalendarHeatmap, { props: props() });
  const days = screen.getByRole("group", { name: "Days" }).getByRole("button");

  const later = screen.getByRole("button", { name: "Later" });
  await later.click();
  await later.click();
  await later.click();
  await expect.element(days.first()).toHaveAccessibleName(/^Monday 7 Sep,/);
  await expect.element(days).toHaveLength(140);

  const earlier = screen.getByRole("button", { name: "Earlier" });
  await earlier.click();
  await earlier.click();
  await earlier.click();
  await expect.element(screen.getByRole("button", { name: /^Wednesday 18 Mar,/ })).toBeVisible();
});

test("keyboard navigation past the edge of the view pages like the nav buttons", async () => {
  const screen = await render(CalendarHeatmap, { props: props() });
  const days = screen.getByRole("group", { name: "Days" }).getByRole("button");

  // 2026-06-24 is in the last week in view
  await screen.getByRole("button", { name: /^Wednesday 24 Jun,/ }).click();
  await userEvent.keyboard("{ArrowDown}");

  await expect.element(screen.getByRole("button", { name: /^Wednesday 1 Jul,/ })).toHaveFocus();
  await expect.element(days.first()).toHaveAccessibleName(/^Monday 20 Apr,/);
});

test("arrow keys move the selection between days", async () => {
  const p = props();
  const screen = await render(CalendarHeatmap, { props: p });

  await screen.getByRole("button", { name: /^Wednesday 18 Mar,/ }).click();
  await userEvent.keyboard("{ArrowRight}");
  await expect.poll(() => p.selectedDate?.toString()).toBe("2026-03-19");
  await expect.element(screen.getByRole("button", { name: /^Thursday 19 Mar,/ })).toHaveFocus();

  await userEvent.keyboard("{ArrowDown}");
  await expect.poll(() => p.selectedDate?.toString()).toBe("2026-03-26");
  await expect.element(screen.getByRole("button", { name: /^Thursday 26 Mar,/ })).toHaveFocus();
});

test("clicking a day pins it, and clicking it again clears it", async () => {
  const p = props();
  const screen = await render(CalendarHeatmap, { props: p });
  const saturday = screen.getByRole("button", { name: /^Saturday 21 Mar,/ });

  await saturday.click();
  await expect.element(saturday).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => p.selectedDate?.toString()).toBe("2026-03-21");

  await saturday.click();
  await expect.element(saturday).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => p.selectedDate).toBeNull();
});

test("hovering a day sets hoveredDate, and leaving clears it", async () => {
  const p = props();
  const screen = await render(CalendarHeatmap, { props: p });

  await screen.getByRole("button", { name: /^Saturday 21 Mar,/ }).hover();
  await expect.poll(() => p.hoveredDate?.toString()).toBe("2026-03-21");

  await screen.getByRole("button", { name: "Later" }).hover();
  await expect.poll(() => p.hoveredDate).toBeNull();
});

test("keeps a day tabbable when the selected day has scrolled out of view", async () => {
  const screen = await render(CalendarHeatmap, { props: props() });
  const days = screen.getByRole("group", { name: "Days" }).getByRole("button");
  const thursday = screen.getByRole("button", { name: /^Thursday 19 Mar,/ });

  await thursday.click();
  const later = screen.getByRole("button", { name: "Later" });
  await later.click();
  await later.click();
  await later.click();
  await expect.element(thursday).not.toBeInTheDocument();

  await expect.poll(() => days.elements().filter((el) => el.tabIndex === 0)).toHaveLength(1);
});

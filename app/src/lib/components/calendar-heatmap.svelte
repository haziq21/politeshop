<script lang="ts">
  import { tick } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";

  import ChevronRightIcon from "./icons/chevron-right.svelte";

  interface Props {
    /** Count per day, keyed by ISO date (`2026-03-18`). Days with no entry are empty. */
    counts: Map<string, number>;
    today: Temporal.PlainDate;
    selectedDate?: Temporal.PlainDate | null;
    hoveredDate?: Temporal.PlainDate | null;
    /** Weeks shown at once */
    windowSize?: number;
    /** Weeks shown before the current one */
    todayOffset?: number;
    /** Weeks a nav button moves the view by */
    navSteps?: number;
    /** 1 is Monday, 7 is Sunday */
    weekStartDay?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  }

  let {
    counts,
    today,
    selectedDate = $bindable(null),
    hoveredDate = $bindable(null),
    windowSize = 20,
    todayOffset = 5,
    navSteps = windowSize / 2,
    weekStartDay = 1,
  }: Props = $props();

  // Weeks are placed by index (0 is this week). `shift` is how far the view has slid from where it
  // began; `lo`..`hi` is the furthest it has been since the last slide landed, and every week in
  // that range is rendered.
  let shift = $state(0);
  let lo = $state(0);
  let hi = $state(0);
  const start = $derived(shift - todayOffset);
  const rendered = $derived(Array.from({ length: hi - lo + windowSize }, (_, i) => lo - todayOffset + i));

  function slideTo(week: number) {
    shift = week + todayOffset;
    lo = Math.min(lo, shift);
    hi = Math.max(hi, shift);
    if (prefersReducedMotion.current) settle();
  }

  function settle() {
    lo = hi = shift;
  }

  const startOfWeek = (date: Temporal.PlainDate) => date.subtract({ days: (date.dayOfWeek - weekStartDay + 7) % 7 });
  const weekStart = (week: number) => startOfWeek(today).add({ weeks: week });
  const weekOf = (date: Temporal.PlainDate) =>
    startOfWeek(date).since(startOfWeek(today), { largestUnit: "weeks" }).weeks;
  const weekdays = $derived(
    Array.from({ length: 7 }, (_, i) => weekStart(0).add({ days: i }).toLocaleString("en-US", { weekday: "short" })),
  );
  const month = (date: Temporal.PlainDate) => date.toLocaleString("en-US", { month: "short" });
  const yearIfNotThisYear = (date: Temporal.PlainDate) => (date.year === today.year ? "" : ` ${date.year}`);

  // Each month is labelled on the first week starting in it
  function monthLabel(week: number) {
    const monday = weekStart(week);
    return monday.day <= 7 ? month(monday) + yearIfNotThisYear(monday) : "";
  }

  // The one tab stop: the selected day, else today, else the first day in view
  const inView = (date: Temporal.PlainDate) => weekOf(date) >= start && weekOf(date) < start + windowSize;
  const tabKey = $derived(
    (selectedDate && inView(selectedDate) ? selectedDate : inView(today) ? today : weekStart(start)).toString(),
  );
  const selectedKey = $derived(selectedDate?.toString());
  const todayKey = $derived(today.toString());

  async function onkeydown(e: KeyboardEvent) {
    const grid = e.currentTarget as HTMLElement;
    const button = (e.target as HTMLElement).closest<HTMLElement>("[data-date]");
    // A week is a column when its days are stacked
    const weekIsColumn = button && getComputedStyle(button.parentElement!).flexDirection === "column";
    const keys = weekIsColumn
      ? { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }
      : { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const days = keys[e.key as keyof typeof keys];
    if (!button || !days) return;

    e.preventDefault();
    const next = Temporal.PlainDate.from(button.dataset.date!).add({ days });
    selectedDate = next;

    const week = weekOf(next);
    // Overflowing the view pages by the same step as the nav buttons
    while (week < start) slideTo(start - navSteps);
    while (week >= start + windowSize) slideTo(start + navSteps);

    await tick();
    grid.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus();
  }
</script>

{#snippet nav(direction: -1 | 1, label: string)}
  <button
    type="button"
    aria-label={label}
    onclick={() => slideTo(start + direction * navSteps)}
    class="flex h-(--week-length) w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground opacity-0 transition-opacity duration-150 outline-none group-has-focus-visible:opacity-100 group-hover:opacity-100 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring @min-due-split:h-8 @min-due-split:w-full"
  >
    <ChevronRightIcon
      class={["size-4", direction < 0 ? "rotate-180 @min-due-split:-rotate-90" : "@min-due-split:rotate-90"]}
    />
  </button>
{/snippet}

{#snippet cell(date: Temporal.PlainDate)}
  {@const key = date.toString()}
  {@const count = counts.get(key) ?? 0}
  <button
    type="button"
    data-date={key}
    tabindex={key === tabKey ? 0 : -1}
    aria-pressed={key === selectedKey}
    aria-current={key === todayKey ? "date" : undefined}
    aria-label="{date.toLocaleString('en-US', { weekday: 'long' })} {date.day} {month(date)}{yearIfNotThisYear(
      date,
    )}, {count ? `${count} due` : 'nothing due'}"
    onclick={() => (selectedDate = key === selectedKey ? null : date)}
    onpointerenter={(e) => e.pointerType === "mouse" && (hoveredDate = date)}
    class={[
      "size-4 shrink-0 cursor-pointer rounded-xs outline-none aria-[current=date]:rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
      "aria-pressed:inset-ring-2 aria-pressed:inset-ring-background aria-pressed:ring-2 aria-pressed:ring-foreground",
      "not-aria-pressed:hover:inset-ring-2 not-aria-pressed:hover:inset-ring-background not-aria-pressed:hover:ring-2 not-aria-pressed:hover:ring-muted-foreground",
      count === 0
        ? "bg-muted"
        : count < 2
          ? "bg-heat-1"
          : count < 4
            ? "bg-heat-2"
            : count < 6
              ? "bg-heat-3"
              : "bg-heat-4",
    ]}
  ></button>
{/snippet}

<div
  class="heatmap group relative isolate -ml-11 flex items-end gap-3 pt-9 before:absolute before:-inset-4 before:-z-10 @min-due-split:mr-8 @min-due-split:ml-0 @min-due-split:w-(--week-length) @min-due-split:shrink-0 @min-due-split:flex-col @min-due-split:items-stretch @min-due-split:gap-5 @min-due-split:pt-0"
  style:--view-start={start}
  style:--window-size={windowSize}
  ontransitionend={(e) => e.propertyName === "--view-start" && settle()}
>
  {@render nav(-1, "Earlier")}

  <div class="flex gap-1 @min-due-split:flex-col">
    <div aria-hidden="true" class="flex flex-col gap-1 @min-due-split:flex-row">
      {#each weekdays as weekday}
        <span
          class="flex h-4 w-7 items-center justify-end text-2xs font-medium text-muted-foreground @min-due-split:h-3.5 @min-due-split:w-4 @min-due-split:justify-center"
          >{weekday[0]}<span class="@min-due-split:hidden">{weekday.slice(1)}</span></span
        >
      {/each}
    </div>

    <div class="relative">
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -top-1 -right-11 -left-3 h-0 overflow-x-clip @min-due-split:top-0 @min-due-split:right-auto @min-due-split:-bottom-6 @min-due-split:left-full @min-due-split:ml-2 @min-due-split:h-auto @min-due-split:w-0 @min-due-split:overflow-x-visible @min-due-split:overflow-y-clip"
      >
        {#each rendered as week (week)}
          {@const label = monthLabel(week)}
          {#if label}
            <span
              data-month
              style:--week-index={week}
              class="slot absolute bottom-0 left-3 origin-bottom-left translate-x-(--distance-from-start) -rotate-30 text-2xs leading-4 whitespace-nowrap text-muted-foreground @min-due-split:top-2 @min-due-split:bottom-auto @min-due-split:left-0 @min-due-split:origin-left @min-due-split:translate-x-0 @min-due-split:translate-y-[calc(var(--distance-from-start)-50%)] @min-due-split:rotate-30"
              >{label}</span
            >
          {/if}
        {/each}
      </div>

      <!-- svelte-ignore a11y_no_noninteractive_element_interactions: arrow keys bubble up from the day buttons -->
      <div
        role="group"
        aria-label="Days"
        class="relative -mt-1 -mb-1 -ml-1 w-[calc(var(--window-length)+--spacing(1))] overflow-x-clip p-1 @min-due-split:-mb-6 @min-due-split:ml-0 @min-due-split:h-[calc(var(--window-length)+--spacing(6))] @min-due-split:w-auto @min-due-split:overflow-x-visible @min-due-split:overflow-y-clip @min-due-split:px-0 @min-due-split:pt-1 @min-due-split:pb-6"
        {onkeydown}
        onpointerleave={() => (hoveredDate = null)}
      >
        <div class="relative h-(--week-length) @min-due-split:h-0">
          {#each rendered as week (week)}
            <div
              style:--week-index={week}
              class="slot absolute top-0 left-0 flex translate-x-(--distance-from-start) flex-col gap-1 @min-due-split:translate-x-0 @min-due-split:translate-y-(--distance-from-start) @min-due-split:flex-row"
            >
              {#each { length: 7 } as _, i}
                {@render cell(weekStart(week).add({ days: i }))}
              {/each}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  {@render nav(1, "Later")}
</div>

<style>
  @property --view-start {
    syntax: "<number>";
    inherits: true;
    initial-value: 0;
  }

  .heatmap {
    --cell-stride: calc(var(--spacing) * 5);
    --window-length: calc(var(--window-size) * var(--cell-stride));
    --week-length: calc(7 * var(--cell-stride) - var(--spacing));
  }

  @media (prefers-reduced-motion: no-preference) {
    .heatmap {
      transition: --view-start 300ms cubic-bezier(0.215, 0.61, 0.355, 1);
    }
  }

  .slot {
    --weeks-from-start: calc(var(--week-index) - var(--view-start));
    --distance-from-start: calc(var(--weeks-from-start) * var(--cell-stride));
  }

  [data-month] {
    opacity: calc(
      clamp(0, (var(--weeks-from-start) + 0.5) * 1000, 1) *
        clamp(0, (var(--window-size) - 0.5 - var(--weeks-from-start)) * 1000, 1)
    );
  }
</style>

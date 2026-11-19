<script lang="ts">
  import { tick } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";

  import ChevronRightIcon from "./icons/chevron-right.svelte";

  interface Props {
    /** Number of entries on a day; days with none are empty */
    countFor: (date: Temporal.PlainDate) => number;
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
    countFor,
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
    class="flex h-(--week-length) w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground opacity-0 transition-opacity duration-150 outline-none group-hover:opacity-100 group-has-focus-visible:opacity-100 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring @2xl:h-8 @2xl:w-full"
  >
    <ChevronRightIcon class={["size-4", direction < 0 ? "rotate-180 @2xl:-rotate-90" : "@2xl:rotate-90"]} />
  </button>
{/snippet}

{#snippet cell(date: Temporal.PlainDate)}
  {@const key = date.toString()}
  {@const count = countFor(date)}
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
      "size-4 shrink-0 cursor-pointer rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-[current=date]:rounded-full",
      "aria-pressed:ring-2 aria-pressed:inset-ring-2 aria-pressed:ring-foreground aria-pressed:inset-ring-background",
      "not-aria-pressed:hover:ring-2 not-aria-pressed:hover:inset-ring-2 not-aria-pressed:hover:ring-muted-foreground not-aria-pressed:hover:inset-ring-background",
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
  class="heatmap group relative isolate -ml-11 flex items-end gap-3 pt-9 before:absolute before:-inset-4 before:-z-10 @2xl:mr-8 @2xl:ml-0 @2xl:w-(--week-length) @2xl:shrink-0 @2xl:flex-col @2xl:items-stretch @2xl:gap-5 @2xl:pt-0"
  style:--view-start={start}
  style:--window-size={windowSize}
  ontransitionend={(e) => e.propertyName === "--view-start" && settle()}
>
  {@render nav(-1, "Earlier")}

  <div class="flex gap-1 @2xl:flex-col">
    <div aria-hidden="true" class="flex flex-col gap-1 @2xl:flex-row">
      {#each weekdays as weekday}
        <span
          class="flex h-4 w-7 items-center justify-end text-2xs font-medium text-muted-foreground @2xl:h-3.5 @2xl:w-4 @2xl:justify-center"
          >{weekday[0]}<span class="@2xl:hidden">{weekday.slice(1)}</span></span
        >
      {/each}
    </div>

    <div class="relative">
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -top-1 -right-11 -left-3 h-0 overflow-x-clip @2xl:top-0 @2xl:right-auto @2xl:-bottom-6 @2xl:left-full @2xl:ml-2 @2xl:h-auto @2xl:w-0 @2xl:overflow-x-visible @2xl:overflow-y-clip"
      >
        {#each rendered as week (week)}
          {@const label = monthLabel(week)}
          {#if label}
            <span
              data-month
              style:--week-index={week}
              class="slot absolute bottom-0 left-3 origin-bottom-left translate-x-(--distance-from-start) -rotate-30 text-2xs/4 whitespace-nowrap text-muted-foreground @2xl:top-2 @2xl:bottom-auto @2xl:left-0 @2xl:origin-left @2xl:translate-x-0 @2xl:translate-y-[calc(var(--distance-from-start)-50%)] @2xl:rotate-30"
              >{label}</span
            >
          {/if}
        {/each}
      </div>

      <!-- svelte-ignore a11y_no_noninteractive_element_interactions: arrow keys bubble up from the day buttons -->
      <div
        role="group"
        aria-label="Days"
        class="relative -my-1 -ml-1 w-[calc(var(--window-length)+(--spacing(1)))] overflow-x-clip p-1 @2xl:-mb-6 @2xl:ml-0 @2xl:h-[calc(var(--window-length)+(--spacing(6)))] @2xl:w-auto @2xl:overflow-x-visible @2xl:overflow-y-clip @2xl:px-0 @2xl:pt-1 @2xl:pb-6"
        {onkeydown}
        onpointerleave={() => (hoveredDate = null)}
      >
        <div class="relative h-(--week-length) @2xl:h-0">
          {#each rendered as week (week)}
            <div
              style:--week-index={week}
              class="slot absolute top-0 left-0 flex translate-x-(--distance-from-start) flex-col gap-1 @2xl:translate-x-0 @2xl:translate-y-(--distance-from-start) @2xl:flex-row"
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

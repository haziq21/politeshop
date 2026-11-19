<script lang="ts">
  import type { DeadlineItem } from "#lib/deadlines.ts";

  import CalendarHeatmap from "#lib/components/calendar-heatmap.svelte";
  import ChevronRightIcon from "#lib/components/icons/chevron-right.svelte";
  import EventAvailableIcon from "#lib/components/icons/event-available.svelte";
  import QuizIcon from "#lib/components/icons/quiz.svelte";
  import TaskAltIcon from "#lib/components/icons/task-alt.svelte";
  import UploadFileIcon from "#lib/components/icons/upload-file.svelte";

  interface Props {
    items: DeadlineItem[];
    today: Temporal.PlainDate;
    /** Length of the default window, starting today */
    defaultWindowDays?: number;
  }

  let { items, today, defaultWindowDays = 14 }: Props = $props();

  const sorted = $derived(items.toSorted((a, b) => Temporal.ZonedDateTime.compare(a.dueAt, b.dueAt)));

  // The list changes height as days are hovered, which resizes the page under the pointer and shifts
  // the scroll position. It never shrinks below the tallest it has been.
  let minListHeight = $state(0);

  let selectedDate = $state<Temporal.PlainDate | null>(null);
  let hoveredDate = $state<Temporal.PlainDate | null>(null);

  const dueByDay = $derived(Map.groupBy(sorted, (item) => item.dueAt.toPlainDate().toString()));

  const activeDate = $derived(hoveredDate ?? selectedDate);
  const activeItems = $derived(
    activeDate
      ? (dueByDay.get(activeDate.toString()) ?? [])
      : sorted.filter(({ dueAt }) => {
          const day = dueAt.toPlainDate();
          return (
            Temporal.PlainDate.compare(day, today) >= 0 &&
            Temporal.PlainDate.compare(day, today.add({ days: defaultWindowDays })) < 0
          );
        }),
  );
</script>

<div class="@container w-full">
  <section aria-label="Upcoming deadlines" class="grid justify-end gap-8 @2xl:flex @2xl:gap-10">
    <div
      class="w-full max-w-106 @2xl:w-92 @2xl:shrink-0"
      bind:clientHeight={null, (height) => (minListHeight = Math.max(minListHeight, height ?? 0))}
      style:min-height="{minListHeight}px"
    >
      <div class="flex w-full flex-col gap-3">
        <h2 class="flex h-6 items-center text-lg font-semibold tracking-tight text-foreground">
          {activeDate
            ? `${activeDate.toLocaleString("en-US", { weekday: "long" })} ${activeDate.day} ${activeDate.toLocaleString("en-US", { month: "short" })}${activeDate.year === today.year ? "" : ` ${activeDate.year}`}`
            : `Next ${defaultWindowDays} days`}
        </h2>

        {#if activeItems.length}
          <ul class="flex flex-col gap-0.5">
            {#each activeItems as item (`${item.type}-${item.id}`)}
              {@const ItemIcon = item.type === "quiz" ? QuizIcon : UploadFileIcon}
              <li title={item.name} class="-mx-1 flex items-start gap-2.5 rounded-xl border border-transparent p-3">
                <ItemIcon class="mt-px size-4 shrink-0 text-muted-foreground" />
                <div class="flex min-w-0 flex-col gap-1">
                  <span class="truncate text-sm leading-[1.2] font-medium text-foreground">
                    <span class="text-muted-foreground">{item.moduleCode}</span><ChevronRightIcon
                      class="mx-px inline size-4 -translate-y-0.5 text-muted-foreground/60"
                    />{item.name}
                  </span>
                  <span class="flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground">
                    <span
                      >Due {item.dueAt.day}
                      {item.dueAt.toLocaleString("en-US", { month: "short" })},
                      {item.dueAt.toPlainTime().toString({ smallestUnit: "minute" })}</span
                    >
                    {#if item.submissionCount > 0}
                      <span
                        aria-hidden="true"
                        class="size-0.75 translate-y-[-0.5px] rounded-full bg-muted-foreground/40"
                      ></span>
                      <span
                        class="inline-flex items-center gap-1"
                        aria-label="{item.submissionCount} {item.submissionCount === 1 ? 'submission' : 'submissions'}"
                      >
                        <TaskAltIcon class="size-3.5 text-muted-foreground/60" />{item.submissionCount}
                      </span>
                    {/if}
                  </span>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <ul class="flex flex-col gap-0.5">
            {#each [activeDate ? "Nothing due" : "Nothing due soon", "", ""] as text}
              <li class="relative -mx-1 rounded-xl border border-transparent p-3" aria-hidden={!text}>
                <div class="invisible flex flex-col gap-1" aria-hidden="true">
                  <span class="text-sm leading-[1.2]">&nbsp;</span>
                  <span class="text-xs">&nbsp;</span>
                </div>
                <div
                  class="absolute inset-x-2 inset-y-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-input"
                >
                  {#if text}
                    <EventAvailableIcon class="size-5 text-muted-foreground/40" />
                    <p class="text-sm text-muted-foreground/60">{text}</p>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
    <div class="order-first @2xl:sticky @2xl:top-20 @2xl:order-0 @2xl:h-fit">
      <CalendarHeatmap
        countFor={(date) => dueByDay.get(date.toString())?.length ?? 0}
        {today}
        bind:selectedDate
        bind:hoveredDate
      />
    </div>
  </section>
</div>

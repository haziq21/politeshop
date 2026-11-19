<script lang="ts">
  import { onMount } from "svelte";

  import CalendarHeatmap from "#lib/components/calendar-heatmap.svelte";
  import ChevronRightIcon from "#lib/components/icons/chevron-right.svelte";
  import EventAvailableIcon from "#lib/components/icons/event-available.svelte";
  import QuizIcon from "#lib/components/icons/quiz.svelte";
  import TaskAltIcon from "#lib/components/icons/task-alt.svelte";
  import UploadFileIcon from "#lib/components/icons/upload-file.svelte";
  import ModuleSelector from "#lib/components/module-selector.svelte";
  import ThemeToggle from "#lib/components/theme-toggle.svelte";
  import { getPreferences, type Preferences } from "#lib/preferences.ts";

  import type { PageProps } from "./$types";

  import { sync } from "./sync.remote";

  let { data }: PageProps = $props();

  type SyncedData = Awaited<ReturnType<typeof sync>>;
  let synced = $state<SyncedData | null>(null);

  let organization = $derived(synced?.organization ?? data.organization);
  let semesters = $derived(synced?.semesters ?? data.semesters);
  let modules = $derived(synced?.modules ?? data.modules);
  let due = $derived(synced?.dueItems ?? data.dueItems);
  // Times show in the browser's time zone, so the section renders on the client only
  let today = $state<Temporal.PlainDate | null>(null);
  const dueItems = $derived(
    [
      ...due.dropboxes.map((d) => ({ ...d, kind: "submission" as const })),
      ...due.quizzes.map((q) => ({ ...q, kind: "quiz" as const, submissionCount: 0 })),
    ]
      .map((item) => ({ ...item, dueAt: item.dueAt!.toZonedDateTimeISO(Temporal.Now.timeZoneId()) }))
      .toSorted((a, b) => Temporal.ZonedDateTime.compare(a.dueAt, b.dueAt)),
  );
  let prefs = $state<Preferences | null>(null);

  const UPCOMING_DAYS = 14;

  onMount(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = Temporal.Now.zonedDateTimeISO();
      today = now.toPlainDate();
      timer = setTimeout(update, now.add({ days: 1 }).startOfDay().epochMilliseconds - now.epochMilliseconds);
    };
    update();
    return () => clearTimeout(timer);
  });

  // The list changes height as days are hovered, which resizes the page under the pointer and shifts
  // the scroll position. It never shrinks below the tallest it has been.
  let minListHeight = $state(0);

  let selectedDate = $state<Temporal.PlainDate | null>(null);
  let hoveredDate = $state<Temporal.PlainDate | null>(null);

  const dueByDay = $derived(Map.groupBy(dueItems, (item) => item.dueAt.toPlainDate().toString()));
  const dueCounts = $derived(new Map(Array.from(dueByDay, ([key, group]) => [key, group.length] as const)));

  const listedDate = $derived(hoveredDate ?? selectedDate);
  const listedItems = $derived(
    listedDate
      ? (dueByDay.get(listedDate.toString()) ?? [])
      : dueItems.filter(({ dueAt }) => {
          const day = dueAt.toPlainDate();
          return (
            !!today &&
            Temporal.PlainDate.compare(day, today) >= 0 &&
            Temporal.PlainDate.compare(day, today.add({ days: UPCOMING_DAYS })) < 0
          );
        }),
  );

  let institutionSubText = $derived.by(() => {
    if (!data.semesterBreak) return "View academic calendar";

    const { daysToEnd, daysToStart, isCurrent, name } = data.semesterBreak;
    if (!isCurrent) {
      return `${daysToStart} day${daysToStart > 1 ? "s" : ""} until semester ${name} starts`;
    }

    return `${daysToEnd} day${daysToEnd > 1 ? "s" : ""} until semester resumes`;
  });

  onMount(async () => {
    prefs = await getPreferences();
    synced = await sync();
  });
</script>

<svelte:head>
  <title>POLITEShop</title>
</svelte:head>

<header class="flex h-15 items-center justify-end px-4">
  <ThemeToggle />
</header>

<img src={organization.bannerImageURL} alt="Banner" class="w-full h-50 object-cover" draggable="false" />
<div class="mx-auto w-full max-w-page">
  <h1 class="text-3xl font-semibold mx-35 mt-10">{organization.name}</h1>

  <a
    href={organization.academicCalendarLink ?? undefined}
    target="_blank"
    class:hover:text-muted-foreground-hover={!!organization.academicCalendarLink}
    class="mx-35 font-medium text-xs text-muted-foreground"
  >
    {institutionSubText}
  </a>

  <div class="grid grid-cols-[auto_minmax(0,1fr)] justify-items-center mt-10 ml-5 pb-60">
    <ModuleSelector filteredSemesterId={prefs?.semester ?? "all"} {semesters} {modules} />
    <div class="h-fit w-full pr-27 pl-11">
      <div class="@container w-full">
        {#if today && dueItems.length}
          <section
            aria-label="Upcoming deadlines"
            class="grid justify-end gap-8 @min-due-split:flex @min-due-split:gap-10"
          >
            <div
              class="w-full max-w-106 @min-due-split:w-92 @min-due-split:shrink-0"
              bind:clientHeight={null, (height) => (minListHeight = Math.max(minListHeight, height ?? 0))}
              style:min-height="{minListHeight}px"
            >
              <div class="flex w-full flex-col gap-3">
                <h2 class="flex h-6 items-center text-lg font-semibold tracking-tight text-foreground">
                  {listedDate
                    ? `${listedDate.toLocaleString("en-US", { weekday: "long" })} ${listedDate.day} ${listedDate.toLocaleString("en-US", { month: "short" })}${listedDate.year === today.year ? "" : ` ${listedDate.year}`}`
                    : `Next ${UPCOMING_DAYS} days`}
                </h2>

                {#if listedItems.length}
                  <ul class="flex flex-col gap-0.5">
                    {#each listedItems as item (`${item.kind}-${item.id}`)}
                      {@const ItemIcon = item.kind === "quiz" ? QuizIcon : UploadFileIcon}
                      <li
                        title={item.title}
                        class="-mx-1 flex items-start gap-2.5 rounded-xl border border-transparent px-3 py-3"
                      >
                        <ItemIcon class="mt-px size-4 shrink-0 text-muted-foreground" />
                        <div class="flex min-w-0 flex-col gap-1">
                          <span class="truncate text-sm leading-[1.2] font-medium text-foreground">
                            <span class="text-muted-foreground">{item.moduleCode}</span><ChevronRightIcon
                              class="mx-px inline size-4 -translate-y-0.5 text-muted-foreground/60"
                            />{item.title}
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
                                class="size-0.75 -translate-y-[0.5px] rounded-full bg-muted-foreground/40"
                              ></span>
                              <span
                                class="inline-flex items-center gap-1"
                                aria-label="{item.submissionCount} {item.submissionCount === 1
                                  ? 'submission'
                                  : 'submissions'}"
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
                    {#each [listedDate ? "Nothing due" : "Nothing due soon", "", ""] as text}
                      <li class="relative -mx-1 rounded-xl border border-transparent px-3 py-3" aria-hidden={!text}>
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
            <div
              class="order-first @min-due-split:sticky @min-due-split:top-20 @min-due-split:order-0 @min-due-split:h-fit"
            >
              <CalendarHeatmap counts={dueCounts} {today} bind:selectedDate bind:hoveredDate />
            </div>
          </section>
        {/if}
      </div>
    </div>
  </div>
</div>

<script lang="ts">
  import { onMount } from "svelte";

  import ModuleSelector from "#lib/components/module-selector.svelte";
  import ThemeToggle from "#lib/components/theme-toggle.svelte";
  import UpcomingDeadlines from "#lib/components/upcoming-deadlines.svelte";
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
      ...due.dropboxes.map((d) => ({ ...d, type: "submission" as const })),
      ...due.quizzes.map((q) => ({ ...q, type: "quiz" as const, submissionCount: 0 })),
    ].map((item) => ({ ...item, dueAt: item.dueAt!.toZonedDateTimeISO(Temporal.Now.timeZoneId()) })),
  );
  let prefs = $state<Preferences | null>(null);

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

<img src={organization.bannerImageURL} alt="Banner" class="h-50 w-full object-cover" draggable="false" />
<div class="mx-auto w-full max-w-page">
  <h1 class="mx-35 mt-10 text-3xl font-semibold">{organization.name}</h1>

  <a
    href={organization.academicCalendarLink ?? undefined}
    target="_blank"
    class:hover:text-muted-foreground-hover={!!organization.academicCalendarLink}
    class="mx-35 text-xs font-medium text-muted-foreground"
  >
    {institutionSubText}
  </a>

  <div class="mt-10 ml-5 grid grid-cols-[auto_minmax(0,1fr)] justify-items-center pb-60">
    <ModuleSelector filteredSemesterId={prefs?.semester ?? "all"} {semesters} {modules} />
    <div class="h-fit w-full pr-27 pl-11">
      {#if today && dueItems.length}
        <UpcomingDeadlines items={dueItems} {today} />
      {/if}
    </div>
  </div>
</div>

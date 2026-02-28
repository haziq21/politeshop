<script lang="ts">
    import { onMount } from "svelte";
    import type { PageProps } from "./$types";
    import ModuleSelector from "$lib/components/module-selector.svelte";
    import DueDateHeatmap from "$lib/components/due-date-heatmap.svelte";
    import { sync } from "./sync.remote";

    let { data }: PageProps = $props();

    type SyncedData = Awaited<ReturnType<typeof sync>>;
    let synced = $state<SyncedData | null>(null);

    let organization = $derived(synced?.organization ?? data.organization);
    let semesters = $derived(synced?.semesters ?? data.semesters);
    let modules = $derived(synced?.modules ?? data.modules);

    let institutionSubText = $derived.by(() => {
        if (!data.semesterBreak) return "View academic calendar";

        const { daysToEnd, daysToStart, isCurrent, name } = data.semesterBreak;
        if (!isCurrent) {
            return `${daysToStart} day${daysToStart > 1 ? "s" : ""} until semester ${name} starts`;
        }

        return `${daysToEnd} day${daysToEnd > 1 ? "s" : ""} until semester resumes`;
    });

    onMount(async () => {
        synced = await sync();
    });
</script>

<svelte:head>
    <title>POLITEShop</title>
</svelte:head>

<img
    src={organization.bannerImageURL}
    alt="Banner"
    class="w-full h-50 mt-15 object-cover"
    draggable="false"
/>
<h1 class="text-3xl font-semibold mx-35 mt-10">{organization.name}</h1>

<a
    href={organization.academicCalendarLink ?? undefined}
    target="_blank"
    class:hover:text-stone-400={!!organization.academicCalendarLink}
    class="mx-35 font-medium text-xs text-stone-500"
>
    {institutionSubText}
</a>

<div class="grid grid-cols-[auto_1fr] justify-items-center mt-10 ml-5 pb-60">
    <ModuleSelector
        filteredSemesterId={data.defaultSemester}
        {semesters}
        {modules}
    />
    <div class="sticky top-10 h-fit">
        <DueDateHeatmap {modules} />
    </div>
</div>

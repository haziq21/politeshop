<script lang="ts">
    import type { PageProps } from "./$types";
    import ModuleSelector from "$lib/components/module-selector.svelte";
    import DueDateHeatmap from "$lib/components/due-date-heatmap.svelte";

    let { data }: PageProps = $props();
</script>

<svelte:head>
    <title>POLITEShop</title>
</svelte:head>

<img
    src={data.organization.bannerImageURL}
    alt="Banner"
    class="w-full h-50 mt-15 object-cover"
    draggable="false"
/>
<h1 class="text-3xl font-semibold mx-35 mt-10">{data.organization.name}</h1>

<a
    href={data.organization.academicCalendarLink ?? undefined}
    target="_blank"
    class:hover:text-stone-400={!!data.organization.academicCalendarLink}
    class="mx-35 font-medium text-xs text-stone-500"
>
    {#if data.semesterBreak}
        {#if data.semesterBreak.isCurrent}
            {data.semesterBreak.daysToEnd} days until semester resumes
        {:else}
            {data.semesterBreak.daysToStart} days until semester {data
                .semesterBreak.name} starts
        {/if}
    {:else if data.organization.academicCalendarLink}
        View academic calendar
    {/if}
</a>

<div class="grid grid-cols-[auto_1fr] justify-items-center mt-10 ml-5 pb-60">
    <ModuleSelector
        filteredSemesterId={data.defaultSemester}
        semesters={data.semesters}
        modules={data.modules}
    />
    <div class="sticky top-10 h-fit">
        <DueDateHeatmap modules={data.modules} />
    </div>
</div>

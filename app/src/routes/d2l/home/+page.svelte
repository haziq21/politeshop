<script lang="ts">
  import type { PageData } from "./$types";
  import ModuleSelector from "$lib/components/module-selector.svelte";
  import DueDateHeatmap from "$lib/components/due-date-heatmap.svelte";

  let { data }: { data: PageData } = $props();

  const { organization, semesters, modules, defaultSemester, semesterBreak } = $derived(data);
</script>

<svelte:head>
  <title>POLITEShop</title>
</svelte:head>

<img src={organization.bannerImageURL} alt="Banner" class="w-full h-50 mt-15 object-cover" draggable="false" />
<h1 class="text-3xl font-semibold mx-35 mt-10">{organization.name}</h1>

<a
  href={organization.academicCalendarLink ?? undefined}
  target="_blank"
  class:hover:text-stone-400={!!organization.academicCalendarLink}
  class="mx-35 font-medium text-xs text-stone-500"
>
  {#if semesterBreak}
    {#if semesterBreak.isCurrent}
      {semesterBreak.daysToEnd} days until semester resumes
    {:else}
      {semesterBreak.daysToStart} days until semester {semesterBreak.name} starts
    {/if}
  {:else if organization.academicCalendarLink}
    View academic calendar
  {/if}
</a>

<div class="grid grid-cols-[auto_1fr] justify-items-center mt-10 ml-5 pb-60">
  <ModuleSelector filteredSemesterId={defaultSemester} {semesters} {modules} />
  <div class="sticky top-10 h-fit">
    <DueDateHeatmap {modules} />
  </div>
</div>

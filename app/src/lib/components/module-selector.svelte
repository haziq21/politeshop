<script lang="ts">
  import type { Module, Semester } from "$lib/server/db";

  import { setPreference } from "$lib/preferences";

  import ModuleList from "./module-list.svelte";
  import SemesterFilter from "./semester-filter.svelte";

  interface Props {
    filteredSemesterId: string;
    semesters: Semester[];
    modules: Module[];
  }

  let { filteredSemesterId = "all", semesters, modules }: Props = $props();

  $effect(() => {
    setPreference("semester", filteredSemesterId);
  });
</script>

<div class="flex gap-4">
  <div class="mt-3 min-w-23 sticky top-20 h-fit">
    <SemesterFilter options={semesters} bind:value={filteredSemesterId} />
  </div>

  <ModuleList
    modules={filteredSemesterId !== "all" ? modules.filter((mod) => mod.semesterId === filteredSemesterId) : modules}
  />
</div>

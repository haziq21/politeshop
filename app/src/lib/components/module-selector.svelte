<script lang="ts">
  import type { Module, Semester } from "#lib/server/db/index.ts";

  import { setPreference } from "#lib/preferences.ts";

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
  <div class="sticky top-20 mt-3 h-fit min-w-23">
    <SemesterFilter options={semesters} bind:value={filteredSemesterId} />
  </div>

  <ModuleList
    modules={filteredSemesterId !== "all" ? modules.filter((mod) => mod.semesterId === filteredSemesterId) : modules}
  />
</div>

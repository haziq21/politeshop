<script lang="ts">
  import type { Module, Semester } from "../db";
  import ModuleList from "./ModuleList.svelte";
  import SemesterFilter from "./SemesterFilter.svelte";

  interface Props {
    filteredSemesterId: string;
    semesters: Semester[];
    modules: Module[];
  }

  let { filteredSemesterId = "all", semesters, modules }: Props = $props();

  let firstRun = true;
  $effect(() => {
    filteredSemesterId;
    if (firstRun) {
      firstRun = false;
      return;
    }
    document.cookie = `defaultSemester=${filteredSemesterId}; SameSite=None; Secure; Max-Age=31536000`;
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

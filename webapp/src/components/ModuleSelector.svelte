<script lang="ts">
  import { actions } from "astro:actions";
  import type { Module, Semester } from "../db";
  import ModuleList from "./ModuleList.svelte";
  import SemesterFilter from "./SemesterFilter.svelte";

  interface Props {
    filteredSemesterId: string | undefined;
    semesters: Semester[];
    modules: Module[];
  }

  let { filteredSemesterId, semesters, modules }: Props = $props();

  let effectHasRun = false;
  $effect(() => {
    // Read filteredSemesterId to register it as a dependency of the effect
    filteredSemesterId;
    // No need to call the action on the first render
    if (!effectHasRun) effectHasRun = true;
    else actions.setDefaultSemesterFilter(filteredSemesterId);
  });
</script>

<div class="flex gap-4">
  <div class="mt-3 min-w-23 sticky top-20 h-fit">
    <SemesterFilter options={semesters} bind:value={filteredSemesterId} />
  </div>

  <ModuleList modules={filteredSemesterId ? modules.filter((mod) => mod.semesterId === filteredSemesterId) : modules} />
</div>

<script lang="ts">
  import { onMount } from "svelte";
  import type { Module, Semester } from "../db";
  import ModuleList from "./ModuleList.svelte";
  import SemesterFilter from "./SemesterFilter.svelte";

  interface Props {
    semesters: Semester[];
    modules: Module[];
  }

  let { semesters, modules }: Props = $props();
  const semestersWithAll = [{ id: "all", name: "All" }, ...semesters];
  let filteredSem = $state(semestersWithAll[0]);
</script>

<div class="flex gap-4">
  <div class="mt-3 min-w-23">
    <SemesterFilter options={semestersWithAll} bind:value={filteredSem} />
  </div>

  <ModuleList
    modules={filteredSem.id === "all" ? modules : modules.filter((mod) => mod.semesterId === filteredSem.id)}
  />
</div>

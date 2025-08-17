<script lang="ts">
  import type { Semester } from "../db";

  interface Props {
    options: Semester[];
    value: string;
  }

  let { options, value = $bindable("all") }: Props = $props();

  // Add an "All" option to disable the filter
  const optionsWithAll = [{ id: "all", name: "All" }, ...options];
  // The value of the selected radio input
</script>

<form class="flex flex-col items-end gap-2">
  {#each optionsWithAll as sem}
    <label
      class="bg-stone-800 hover:bg-stone-700 has-checked:bg-stone-600 text-xs text-stone-400
      has-checked:text-stone-200 focus-within:ring px-3 py-2 rounded-md cursor-pointer"
    >
      <input type="radio" name="filter" value={sem.id} class="absolute opacity-0" bind:group={value} />
      {sem.name}
    </label>
  {/each}
</form>

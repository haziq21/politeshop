<script lang="ts">
  import type { Semester } from "../db";

  interface Props {
    options: Semester[];
    value: string | undefined;
  }

  let { options, value = $bindable() }: Props = $props();

  // Add an "All" option to disable the filter
  const optionsWithAll = [{ id: "all", name: "All" }, ...options];
  // The value of the selected radio input
  let valueOrAll = $state(value || "all");
  // This component uses "all" to represent no filter, but
  // the interface it exposes (via props) uses undefined
  $effect(() => {
    value = valueOrAll === "all" ? undefined : valueOrAll;
  });
</script>

<form class="flex flex-col items-end gap-2">
  {#each optionsWithAll as sem}
    <label
      class="bg-stone-800 hover:bg-stone-700 has-checked:bg-stone-600 text-xs text-stone-400
      has-checked:text-stone-200 focus-within:ring px-3 py-2 rounded-md cursor-pointer"
    >
      <input type="radio" name="filter" value={sem.id} class="absolute opacity-0" bind:group={valueOrAll} />
      {sem.name}
    </label>
  {/each}
</form>

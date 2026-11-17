<script lang="ts">
  import type { Semester } from "$lib/server/db";

  interface Props {
    options: Semester[];
    value: string;
  }

  let { options, value = $bindable("all") }: Props = $props();

  // Add an "All" option to disable the filter
  const optionsWithAll = $derived([{ id: "all", name: "All" }, ...options]);
</script>

<form class="flex flex-col items-end gap-2">
  {#each optionsWithAll as sem}
    <label
      class="bg-card hover:bg-accent has-checked:bg-secondary text-xs text-muted-foreground
      has-checked:text-secondary-foreground border border-input
      has-focus-visible:ring-2 ring-ring px-3 py-2 rounded-lg cursor-pointer"
    >
      <input type="radio" name="filter" value={sem.id} class="absolute opacity-0" bind:group={value} />
      {sem.name}
    </label>
  {/each}
</form>

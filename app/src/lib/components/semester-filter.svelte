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
      class="text-xs text-muted-foreground border border-transparent not-has-checked:hover:border-border
      not-has-checked:hover:bg-card has-checked:border-input has-checked:bg-secondary
      has-checked:text-secondary-foreground has-focus-visible:ring-2 ring-ring px-3 py-2 rounded-lg cursor-pointer"
    >
      <input type="radio" name="filter" value={sem.id} class="absolute opacity-0" bind:group={value} />
      {sem.name}
    </label>
  {/each}
</form>

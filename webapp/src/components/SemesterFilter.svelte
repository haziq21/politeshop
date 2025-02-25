<script lang="ts">
  import type { Semester } from "../db";

  interface Props {
    options: Semester[];
    value: Semester;
  }

  let { options, value = $bindable() }: Props = $props();
  let selectedId = $state(value.id);

  $effect(() => {
    value = options.find((sem) => sem.id === selectedId) || options[0];
  });
</script>

<form class="flex flex-col items-end gap-2">
  {#each options as sem, i}
    <label
      class="bg-stone-800 hover:bg-stone-700 has-checked:bg-stone-600 text-xs text-stone-400
      has-checked:text-stone-200 focus-within:ring px-3 py-2 rounded-md cursor-pointer"
    >
      <input type="radio" name="filter" value={sem.id} class="absolute opacity-0" bind:group={selectedId} />
      {sem.name}
    </label>
  {/each}
</form>

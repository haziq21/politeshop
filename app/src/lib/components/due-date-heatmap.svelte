<script lang="ts">
  import type { Module } from "$lib/server/db";

  interface Props {
    modules: Module[];
  }

  let { modules }: Props = $props();
</script>

<div>
  <p class="block font-medium text-sm text-muted-foreground">x items due soon</p>

  <div class="grid grid-rows-7 grid-flow-col gap-1 h-fit w-fit mt-4">
    {#each { length: 7 * 4 * 6 } as i}
      <div class="w-4 h-4 bg-muted rounded-md"></div>
    {/each}
  </div>
</div>

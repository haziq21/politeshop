<div>
  <p class="block font-medium text-sm text-stone-600">x items due soon</p>

  <div class="grid grid-rows-7 grid-flow-col gap-1 h-fit w-fit mt-4">
    {#each { length: 7 * 4 * 6 } as i}
      <div class="w-4 h-4 bg-stone-800 rounded-sm"></div>
    {/each}
  </div>
</div>

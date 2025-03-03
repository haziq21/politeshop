<script lang="ts">
  import type { Module } from "../db";

  interface Props {
    modules: Module[];
  }

  let { modules }: Props = $props();
</script>

<ul class="flex flex-col gap-1 max-w-140">
  {#each modules as mod}
    <li class="">
      <a
        href="#top"
        class="group grid grid-rows-[repeat(3,auto)] grid-cols-[auto_1fr] hover:bg-stone-800
          border border-transparent hover:border-stone-700 pl-3 pr-6 py-3 rounded-lg"
      >
        <img
          src={mod.imageIconURL}
          alt=""
          draggable="false"
          class="w-15 h-15 mr-3 object-cover rounded-md row-span-full"
        />
        <p class="font-bold text-xs text-stone-500 group-hover:text-stone-400 leading-none self-end">
          {mod.niceCode || mod.code}
        </p>
        <p class="text-lg self-center whitespace-nowrap overflow-hidden overflow-ellipsis">
          {mod.niceName || mod.name}
        </p>
        <p class="font-light text-sm text-stone-400 group-hover:text-stone-300 leading-none self-start">
          Nothing new here
        </p>
      </a>
    </li>
  {/each}
</ul>

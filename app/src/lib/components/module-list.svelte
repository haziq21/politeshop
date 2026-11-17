<script lang="ts">
  import type { Module } from "$lib/server/db";

  interface Props {
    modules: Module[];
  }

  let { modules }: Props = $props();
</script>

<ul class="flex flex-col gap-1 w-140">
  {#each modules as mod}
    <li class="">
      <a
        href={`/d2l/home/${mod.id}`}
        class="group grid grid-rows-[repeat(3,auto)] grid-cols-[auto_1fr] hover:bg-card
          border border-transparent hover:border-border pl-3 pr-6 py-3 rounded-xl"
      >
        <img
          src={mod.imageIconURL}
          alt=""
          draggable="false"
          class="w-15 h-15 mr-3 object-cover rounded-lg row-span-full"
        />
        <p
          class="font-bold text-xs text-muted-foreground group-hover:text-muted-foreground-hover leading-none self-end"
        >
          {mod.niceCode || mod.code}
        </p>
        <p class="text-lg self-center whitespace-nowrap overflow-hidden overflow-ellipsis">
          {mod.niceName || mod.name}
        </p>
        <p
          class="font-light text-sm text-muted-foreground group-hover:text-muted-foreground-hover leading-none self-start"
        >
          Nothing new here
        </p>
      </a>
    </li>
  {/each}
</ul>

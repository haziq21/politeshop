<script lang="ts">
  import type { Module } from "#lib/server/db/index.ts";

  interface Props {
    modules: Module[];
  }

  let { modules }: Props = $props();
</script>

<ul class="flex w-lg flex-col gap-1">
  {#each modules as mod}
    <li class="">
      <a
        href={`/d2l/home/${mod.id}`}
        class="group flex items-center gap-3 rounded-xl border border-transparent py-3 pr-6 pl-3 hover:border-border hover:bg-card"
      >
        <div class="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
          {#if mod.imageIconURL}
            <img
              src={mod.imageIconURL}
              alt=""
              draggable="false"
              class="size-full object-cover"
              onerror={(e) => ((e.currentTarget as HTMLImageElement).hidden = true)}
            />
          {/if}
        </div>
        <div class="min-w-0 pt-0.5">
          <p class="text-xs leading-none font-bold text-muted-foreground group-hover:text-muted-foreground-hover">
            {mod.niceCode || mod.code}
          </p>
          <p class="mt-1 truncate text-lg/tight">
            {mod.niceName || mod.name}
          </p>
        </div>
      </a>
    </li>
  {/each}
</ul>

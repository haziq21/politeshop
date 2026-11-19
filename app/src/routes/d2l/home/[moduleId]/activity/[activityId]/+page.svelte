<script lang="ts">
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let activity = $derived(data.activity);
  let module = $derived(data.module);
  let folderPath = $derived.by(() => {
    const byId = new Map(data.activities.map((a) => [a.id, a]));
    const path = [];
    for (let folder = byId.get(activity.parentId ?? ""); folder; folder = byId.get(folder.parentId ?? "")) {
      path.unshift(folder);
    }
    return path;
  });
</script>

{#snippet separator()}
  <li role="presentation" aria-hidden="true" class="[&>svg]:size-3.5">
    <ChevronRightIcon />
  </li>
{/snippet}

<svelte:head>
  <title>{activity.name} — POLITEShop</title>
</svelte:head>

<main class="flex size-full flex-col overflow-auto">
  <header class="px-6 pt-6 pb-4">
    <nav aria-label="breadcrumb">
      <ol class="flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground">
        <li class="inline-flex items-center gap-1">
          <a href="/d2l/home/{module.id}" class="flex items-center gap-2 transition-colors hover:text-foreground">
            <img src={module.imageIconURL} alt="" class="size-5 rounded object-cover" />
            {module.niceCode || module.code}
          </a>
        </li>
        {#each folderPath as folder}
          {@render separator()}
          <li class="inline-flex items-center gap-1">
            <span class="text-sm text-muted-foreground">{folder.name}</span>
          </li>
        {/each}
        {@render separator()}
        <li class="inline-flex items-center gap-1">
          <span role="link" aria-disabled="true" aria-current="page" class="font-normal text-foreground">
            {activity.name}
          </span>
        </li>
      </ol>
    </nav>
  </header>

  <div class="p-6">
    {#if activity.type === "doc_embed"}
      <div class="aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          src="{activity.previewURL ?? activity.sourceURL}#toolbar=0&navpanes=0"
          title={activity.name}
          class="size-full border-0"
        ></iframe>
      </div>
    {:else if activity.type === "html"}
      <div class="aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          srcdoc={activity.content}
          title={activity.name}
          class="size-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
        ></iframe>
      </div>
    {:else if activity.type === "web_embed"}
      <div class="aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          src={activity.url}
          title={activity.name}
          class="size-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        ></iframe>
      </div>
    {:else if activity.type === "video_embed"}
      <div class="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video src={activity.sourceURL} poster={activity.thumbnailURL ?? undefined} controls class="size-full">
          Your browser does not support the video element.
        </video>
      </div>
    {:else}
      <div class="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl">
        <p class="text-lg text-muted-foreground">Not implemented yet</p>
      </div>
    {/if}
  </div>
</main>

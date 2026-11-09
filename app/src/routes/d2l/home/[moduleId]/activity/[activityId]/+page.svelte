<script lang="ts">
  import { findActivityFolderPath } from "$lib/activityTree";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let activity = $derived(data.activity);
  let module = $derived(data.module);
  let folderPath = $derived(findActivityFolderPath(data.contentFolders, activity.id));
</script>

{#snippet separator()}
  <li role="presentation" aria-hidden="true" class="[&>svg]:size-3.5">
    <ChevronRightIcon />
  </li>
{/snippet}

<svelte:head>
  <title>{activity.name} — POLITEShop</title>
</svelte:head>

<main class="flex h-full w-full flex-col overflow-auto">
  <header class="px-6 pt-6 pb-4">
    <nav aria-label="breadcrumb">
      <ol class="text-muted-foreground gap-1.5 text-sm flex flex-wrap items-center wrap-break-word">
        <li class="gap-1 inline-flex items-center">
          <a href="/d2l/home/{module.id}" class="flex items-center gap-2 hover:text-foreground transition-colors">
            <img src={module.imageIconURL} alt="" class="w-5 h-5 rounded object-cover" />
            {module.niceCode || module.code}
          </a>
        </li>
        {#each folderPath as folder}
          {@render separator()}
          <li class="gap-1 inline-flex items-center">
            <span class="text-muted-foreground text-sm">{folder.name}</span>
          </li>
        {/each}
        {@render separator()}
        <li class="gap-1 inline-flex items-center">
          <span role="link" aria-disabled="true" aria-current="page" class="text-foreground font-normal">
            {activity.name}
          </span>
        </li>
      </ol>
    </nav>
  </header>

  <div class="p-6">
    {#if activity.type === "doc_embed"}
      <div class="aspect-video w-full rounded-lg overflow-hidden">
        <iframe
          src="{activity.previewURL ?? activity.sourceURL}#toolbar=0&navpanes=0"
          title={activity.name}
          class="h-full w-full border-0"
        ></iframe>
      </div>
    {:else if activity.type === "html"}
      <div class="aspect-video w-full rounded-lg overflow-hidden">
        <iframe
          srcdoc={activity.content}
          title={activity.name}
          class="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
        ></iframe>
      </div>
    {:else if activity.type === "web_embed"}
      <div class="aspect-video w-full rounded-lg overflow-hidden">
        <iframe
          src={activity.url}
          title={activity.name}
          class="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        ></iframe>
      </div>
    {:else if activity.type === "video_embed"}
      <div class="aspect-video w-full bg-black rounded-lg overflow-hidden">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video src={activity.sourceURL} poster={activity.thumbnailURL ?? undefined} controls class="h-full w-full">
          Your browser does not support the video element.
        </video>
      </div>
    {:else}
      <div class="flex aspect-video w-full items-center justify-center rounded-lg overflow-hidden">
        <p class="text-muted-foreground text-lg">Not implemented yet</p>
      </div>
    {/if}
  </div>
</main>

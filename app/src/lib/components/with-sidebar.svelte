<script lang="ts">
  import type { ContentFolder } from "$lib/activityTree";
  import type { Module } from "$lib/server/db";
  import type { Snippet } from "svelte";

  import AppSidebar from "$lib/components/app-sidebar.svelte";

  interface Props {
    module: Module;
    contentFolders: ContentFolder[];
    openFolderIds: string[];
    currentActivityId?: string;
    children: Snippet;
  }

  const { module, contentFolders, openFolderIds, currentActivityId, children }: Props = $props();
</script>

<div class="flex min-h-svh w-full" style="--sidebar-width: 18rem;">
  <AppSidebar {module} {contentFolders} {openFolderIds} {currentActivityId} />
  {@render children?.()}
</div>

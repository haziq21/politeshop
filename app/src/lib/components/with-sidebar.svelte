<script lang="ts">
  import type { ContentFolder } from "$lib/activityTree";
  import type { Module } from "$lib/server/db";
  import type { Snippet } from "svelte";

  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";

  interface Props {
    module: Module;
    contentFolders: ContentFolder[];
    openFolderIds: string[];
    children: Snippet;
  }

  const { module, contentFolders, openFolderIds, children }: Props = $props();
</script>

<Sidebar.Provider style="--sidebar-width: 18rem;">
  <AppSidebar {module} {contentFolders} {openFolderIds} />
  {@render children?.()}
</Sidebar.Provider>

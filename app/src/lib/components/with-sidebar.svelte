<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import type { Module, ActivityFolder, AnyActivityWithName } from "$lib/server/db";

  interface Props {
    module: Module;
    activities: AnyActivityWithName[];
    activityFolders: ActivityFolder[];
    children: Snippet;
  }

  const { module, activities, activityFolders, children }: Props = $props();
</script>

<Sidebar.Provider style="--sidebar-width: 18rem;">
  <AppSidebar {module} {activities} {activityFolders} />
  {@render children?.()}
</Sidebar.Provider>

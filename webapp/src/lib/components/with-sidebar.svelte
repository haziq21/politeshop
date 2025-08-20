<!--
  This wrapper component is necessary because client:load needs to be applied on it.
  client:load can't be directly applied to <Sidebar.Provider> because it's a "dynamic tag"
  (because it's imported into and re-exported from $lib/components/ui/sidebar). Refer to
  https://docs.astro.build/en/reference/directives-reference/#client-directives
-->

<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import type { Module, ActivityFolder, AnyActivityWithName } from "../../db";

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

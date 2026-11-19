<script lang="ts">
  import type { Snippet } from "svelte";

  import type { BaseActivity, Module } from "#lib/server/db/index.ts";

  import AppSidebar from "#lib/components/app-sidebar.svelte";

  interface Props {
    module: Module;
    activities: BaseActivity[];
    openFolderIds: string[];
    currentActivityId?: string;
    children: Snippet;
  }

  const { module, activities, openFolderIds, currentActivityId, children }: Props = $props();
</script>

<div class="flex min-h-svh w-full" style="--sidebar-width: 18rem;">
  <AppSidebar {module} {activities} {openFolderIds} {currentActivityId} />
  {@render children?.()}
</div>

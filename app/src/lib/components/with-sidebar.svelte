<script lang="ts">
    import type { Snippet } from "svelte";
    import * as Sidebar from "$lib/components/ui/sidebar";
    import AppSidebar from "$lib/components/app-sidebar.svelte";
    import type { Module } from "$lib/server/db";
    import type { ContentFolder } from "$lib/activityTree";

    interface Props {
        module: Module;
        contentFolders: ContentFolder[];
        children: Snippet;
    }

    const { module, contentFolders, children }: Props = $props();
</script>

<Sidebar.Provider style="--sidebar-width: 18rem;">
    <AppSidebar {module} {contentFolders} />
    {@render children?.()}
</Sidebar.Provider>

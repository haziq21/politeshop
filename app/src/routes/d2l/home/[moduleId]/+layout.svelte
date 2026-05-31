<script lang="ts">
    import { onMount } from "svelte";
    import WithSidebar from "$lib/components/with-sidebar.svelte";
    import { syncModule } from "./sync.remote";

    let { children, data } = $props();

    type SyncedData = Awaited<ReturnType<typeof syncModule>>;
    let synced = $state<SyncedData | null>(null);

    let contentFolders = $derived(
        synced?.contentFolders ?? data.contentFolders,
    );

    onMount(async () => {
        synced = await syncModule({ moduleId: data.module.id });
    });
</script>

<WithSidebar module={data.module} {contentFolders}>
    {@render children()}
</WithSidebar>

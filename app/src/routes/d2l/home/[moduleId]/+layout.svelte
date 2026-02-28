<script lang="ts">
    import { onMount } from "svelte";
    import WithSidebar from "$lib/components/with-sidebar.svelte";
    import { sync } from "./sync.remote";

    let { children, data } = $props();

    type SyncedData = Awaited<ReturnType<typeof sync>>;
    let synced = $state<SyncedData | null>(null);

    let contentFolders = $derived(
        synced?.contentFolders ?? data.contentFolders,
    );

    onMount(async () => {
        synced = await sync();
    });
</script>

<WithSidebar module={data.module} {contentFolders}>
    {@render children()}
</WithSidebar>

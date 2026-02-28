<script lang="ts">
    import { onMount } from "svelte";
    import type { PageProps } from "./$types";
    import WithSidebar from "$lib/components/with-sidebar.svelte";
    import { sync } from "./sync.remote";

    let { data }: PageProps = $props();

    type SyncedData = Awaited<ReturnType<typeof sync>>;
    let synced = $state<SyncedData | null>(null);

    let contentFolders = $derived(
        synced?.contentFolders ?? data.contentFolders,
    );

    onMount(async () => {
        synced = await sync();
    });
</script>

<svelte:head>
    <title>{data.module.niceName ?? data.module.name} — POLITEShop</title>
</svelte:head>

<WithSidebar module={data.module} {contentFolders}>
    <main class="p-6">
        <h1 class="text-2xl font-semibold">
            {data.module.niceName ?? data.module.name}
        </h1>
    </main>
</WithSidebar>

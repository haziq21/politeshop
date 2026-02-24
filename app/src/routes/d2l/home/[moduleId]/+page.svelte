<script lang="ts">
    import type { PageProps } from "./$types";
    import WithSidebar from "$lib/components/with-sidebar.svelte";

    let { data }: PageProps = $props();

    const { module, activityFolders, activities } = $derived(data);
</script>

<svelte:head>
    <title>{module.niceName ?? module.name} — POLITEShop</title>
</svelte:head>

<WithSidebar {module} {activities} {activityFolders}>
    <main class="p-6">
        <h1 class="text-2xl font-semibold">{module.niceName ?? module.name}</h1>
    </main>
</WithSidebar>

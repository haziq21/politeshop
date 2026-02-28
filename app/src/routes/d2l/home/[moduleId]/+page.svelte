<script lang="ts">
    let { data } = $props();
</script>

<svelte:head>
    <title>{data.module.niceName ?? data.module.name} — POLITEShop</title>
</svelte:head>

<main class="p-6">
    <h1 class="text-2xl font-semibold">
        {data.module.niceName ?? data.module.name}
    </h1>
</main>

<script lang="ts">
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();

    let activity = $derived(data.activity);

    $effect(() => console.log(activity));
</script>

<svelte:head>
    <title>{activity.name} — POLITEShop</title>
</svelte:head>

<main class="flex h-full w-full flex-col overflow-auto">
    <header class="border-b px-6 py-4">
        <h1 class="text-xl font-semibold">{activity.name}</h1>
    </header>

    <div class="p-6">
        {#if activity.type === "doc_embed"}
            <div class="aspect-video w-full">
                <iframe
                    src="{activity.previewURL ??
                        activity.sourceURL}#toolbar=0&navpanes=0"
                    title={activity.name}
                    class="h-full w-full border-0"
                ></iframe>
            </div>
        {:else if activity.type === "html"}
            <div class="aspect-video w-full">
                <iframe
                    srcdoc={activity.content}
                    title={activity.name}
                    class="h-full w-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-popups"
                ></iframe>
            </div>
        {:else if activity.type === "web_embed"}
            <div class="aspect-video w-full">
                <iframe
                    src={activity.url}
                    title={activity.name}
                    class="h-full w-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                ></iframe>
            </div>
        {:else if activity.type === "video_embed"}
            <div class="aspect-video w-full bg-black">
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    src={activity.sourceURL}
                    poster={activity.thumbnailURL ?? undefined}
                    controls
                    class="h-full w-full"
                >
                    Your browser does not support the video element.
                </video>
            </div>
        {:else}
            <div class="flex aspect-video w-full items-center justify-center">
                <p class="text-muted-foreground text-lg">Not implemented yet</p>
            </div>
        {/if}
    </div>
</main>

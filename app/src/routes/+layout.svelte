<script lang="ts">
    import "./layout.css";
    import favicon from "$lib/assets/favicon.svg";
    import type { LayoutProps } from "./$types";
    import { onMount } from "svelte";
    import { afterNavigate, goto } from "$app/navigation";
    import { createLinkObserver, overrideInternalLinks } from "./links";

    let { children, data }: LayoutProps = $props();

    onMount(() => {
        overrideInternalLinks(document.body, `${data.domain}.polite.edu.sg`);

        const observer = createLinkObserver((a) => {
            overrideInternalLinks(a, `${data.domain}.polite.edu.sg`);
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributeFilter: ["href"],
        });

        afterNavigate((navigation) => {
            window.top?.postMessage(
                {
                    type: "LOCATION_CHANGED",
                    payload: {
                        path: navigation.to?.url.pathname,
                        title: document.title,
                    },
                },
                `https://${data.domain}.polite.edu.sg`,
            );
        });

        return observer.disconnect;
    });
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <title>POLITEShop</title>
</svelte:head>

<svelte:document
    onclick={(e) => {
        if (!e.target) return;

        const a = (e.target as HTMLElement).closest("a");
        if (!a || a.hostname !== `${data.domain}.polite.edu.sg`) return;

        e.preventDefault();
        goto(a.pathname);
    }}
/>

{@render children()}

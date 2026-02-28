<script lang="ts">
    import "./layout.css";
    import favicon from "$lib/assets/favicon.svg";
    import type { LayoutProps } from "./$types";
    import { onMount } from "svelte";
    import { afterNavigate, goto } from "$app/navigation";
    import { createLinkObserver, overrideInternalLinks } from "./links";

    let { children, data }: LayoutProps = $props();

    onMount(() => {
        overrideInternalLinks(document.body, `${data.subdomain}.polite.edu.sg`);

        const observer = createLinkObserver((a) => {
            overrideInternalLinks(a, `${data.subdomain}.polite.edu.sg`);
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributeFilter: ["href"],
        });

        afterNavigate((navigation) => {
            if (!navigation.to) return;

            const { pathname, search, hash } = navigation.to.url;
            const path = pathname + search + hash;
            window.top?.postMessage(
                {
                    type: "LOCATION_CHANGED",
                    payload: { path, title: document.title },
                },
                `https://${data.subdomain}.polite.edu.sg`,
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
        if (!a || a.hostname !== `${data.subdomain}.polite.edu.sg`) return;

        e.preventDefault();
        goto(a.pathname + a.search + a.hash);
    }}
/>

{@render children()}

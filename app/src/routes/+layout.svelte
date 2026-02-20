<script lang="ts">
    import "./layout.css";
    import favicon from "$lib/assets/favicon.svg";
    import type { LayoutData } from "./$types";
    import { onMount } from "svelte";
    import { page } from "$app/stores";

    let {
        children,
        data,
    }: { children: import("svelte").Snippet; data: LayoutData } = $props();

    onMount(() => {
        // Apply body classes
        document.body.classList.add("h-full", "dark");

        const politeDomain = data.domain;
        if (!politeDomain) return;

        // Store domain for other scripts
        document.body.dataset.domain = politeDomain;

        window.top?.postMessage(
            {
                type: "LOCATION_CHANGED",
                payload: {
                    path: location.pathname,
                    title: document.title,
                },
            },
            `https://${politeDomain}.polite.edu.sg`,
        );

        overridePOLITEShopLinks();

        // Call overridePOLITEShopLinks() when new links appear
        const observer = new MutationObserver((mutations) => {
            const mutationAffectedLink = mutations.some((mutation) => {
                // Check if a link was added
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    const element = node as HTMLElement;
                    if (
                        (element.tagName === "A" &&
                            element.hasAttribute("href") &&
                            !element.dataset.preserveUrl) ||
                        element.querySelector(
                            "a[href]:not([data-preserve-url])",
                        )
                    ) {
                        return true;
                    }
                }

                // Check if a href attribute was changed
                if (
                    mutation.type === "attributes" &&
                    mutation.target.nodeType === Node.ELEMENT_NODE &&
                    mutation.attributeName === "href" &&
                    !(mutation.target as HTMLElement).dataset.preserveUrl
                ) {
                    return true;
                }

                return false;
            });

            if (mutationAffectedLink) overridePOLITEShopLinks();
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributeFilter: ["href"],
        });

        // Intercept link clicks for *.polite.edu.sg and redirect them to POLITEShop
        document.addEventListener("click", (e) => {
            if (!e.target) return;

            const a = (e.target as HTMLElement).closest("a");
            if (!a || a.hostname !== `${politeDomain}.polite.edu.sg`) return;

            e.preventDefault();
            window.location.pathname = a.pathname;
        });

        /** Change link URLs from POLITEShop's domain to `*.polite.edu.sg`. */
        function overridePOLITEShopLinks(
            container: Document | HTMLElement = document,
        ) {
            const links = container.querySelectorAll<HTMLAnchorElement>(
                "a[href]:not([data-preserve-url])",
            );
            links.forEach((link) => {
                if (link.host !== location.host) return;
                link.hostname = `${politeDomain}.polite.edu.sg`;
                link.port = "";
            });
        }
    });

    // Re-send LOCATION_CHANGED on navigation
    $effect(() => {
        const path = $page.url.pathname;
        const politeDomain = data.domain;
        if (!politeDomain || typeof window === "undefined") return;

        window.top?.postMessage(
            {
                type: "LOCATION_CHANGED",
                payload: {
                    path,
                    title: document.title,
                },
            },
            `https://${politeDomain}.polite.edu.sg`,
        );
    });
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <title>POLITEShop</title>
</svelte:head>

{@render children()}

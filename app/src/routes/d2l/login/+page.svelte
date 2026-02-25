<script lang="ts">
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import type { WindowMessage } from "@politeshop/shared";

    const targetEncoded = page.url.searchParams.get("target");
    const target = targetEncoded
        ? decodeURIComponent(targetEncoded)
        : "/d2l/home";

    const sessionExpired = page.url.searchParams.get("sessionExpired") ?? "1";

    onMount(() => {
        window.top?.postMessage(
            {
                type: "REDIRECT_LOGIN",
                payload: { target, sessionExpired },
            } as WindowMessage,
            "*",
        );
    });
</script>

Redirecting to POLITEMall login...

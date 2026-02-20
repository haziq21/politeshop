<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import type { WindowMessage } from "../../../../../shared";

  const target = $derived(decodeURIComponent($page.url.searchParams.get("target") ?? "") || "/d2l/home");
  const sessionExpired = $derived($page.url.searchParams.get("sessionExpired") ?? "1");

  onMount(() => {
    window.top?.postMessage(
      { type: "REDIRECT_LOGIN", payload: { target, sessionExpired } } as WindowMessage,
      "*"
    );
  });
</script>

login!

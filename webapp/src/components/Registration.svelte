<script lang="ts">
  import { actions } from "astro:actions";
  import { onMount } from "svelte";

  let errorOccurred = $state(false);

  onMount(async () => {
    // TODO: Wait for the cookies to be set
    const { error } = await actions.registerUser();
    if (error) errorOccurred = true;
    else location.href = "/";
  });
</script>

{#if !errorOccurred}
  <p>POLITEShop needs a moment to gather your POLITEMall data...</p>
{:else}
  <p>Something went wrong. Please try refreshing...</p>
{/if}

<script lang="ts">
  import { actions } from "astro:actions";
  import { onMount } from "svelte";

  let errorOccurred = $state(false);

  onMount(async () => {
    const { data, error } = await actions.getPOLITEShopJWT();

    if (error) errorOccurred = true;
    else {
      document.cookie = `politeshopJWT=${data}; SameSite=None; Secure`;
      window.location.href = "/d2l/home";
    }
  });
</script>

{#if !errorOccurred}
  <p>POLITEShop needs a moment to gather your POLITEMall data...</p>
{:else}
  <p>Something went wrong. Please try refreshing...</p>
{/if}

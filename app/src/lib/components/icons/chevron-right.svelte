<script lang="ts">
  import type { SVGAttributes } from "svelte/elements";

  let props: SVGAttributes<SVGSVGElement> = $props();
</script>

<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" {...props}
  ><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" /></svg
>

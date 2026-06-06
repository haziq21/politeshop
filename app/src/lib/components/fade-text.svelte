<script lang="ts">
  interface Props {
    text: string;
    class?: string;
  }

  let { text, class: className = "" }: Props = $props();
  let el: HTMLElement | undefined = $state();
  let overflows = $state(false);

  $effect(() => {
    if (!el) return;
    const ro = new ResizeObserver(() => {
      overflows = el!.scrollWidth - el!.clientWidth > 1;
    });
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

<span
  bind:this={el}
  class="whitespace-nowrap block overflow-hidden max-w-full {className}"
  class:[mask-image:linear-gradient(to_right,black_calc(100%-1rem),transparent)]={overflows}
>
  {text}
</span>

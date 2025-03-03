<script lang="ts">
  import type { AnyTreeNode } from "../types";
  import Self from "./PartialActivityTree.svelte";

  interface Props {
    parentId: string | null | undefined;
    allNodesByParent: Map<string | null | undefined, AnyTreeNode[]>;
  }

  let { parentId, allNodesByParent }: Props = $props();
</script>

{#each allNodesByParent.get(parentId)! as node}
  <li>
    {node.name}

    {#if node.isFolder}
      <ul class="pl-4">
        <Self parentId={node.id} {allNodesByParent} />
      </ul>
    {/if}
  </li>
{/each}

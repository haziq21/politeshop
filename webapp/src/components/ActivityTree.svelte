<script lang="ts">
  import type { AnyTreeNode } from "../types";
  import PartialActivityTree from "./PartialActivityTree.svelte";

  interface Props {
    allNodesByParent: Map<string | null | undefined, AnyTreeNode[]>;
  }

  let { allNodesByParent }: Props = $props();
</script>

<ul>
  <PartialActivityTree parentId={null} {allNodesByParent} />
</ul>

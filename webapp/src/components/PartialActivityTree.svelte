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
  <li class="text-stone-400 text-sm mb-1">
    <div class="flex gap-1.5 items-start">
      {#if node.isFolder}
        <svg
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="inline stroke-stone-500 w-4 min-w-4"
        >
          <path
            d="M1.40625 7.96875V7.5C1.40625 7.12704 1.55441 6.76935 1.81813 6.50563C2.08185 6.24191 2.43954 6.09375 2.8125 6.09375H12.1875C12.5605 6.09375 12.9181 6.24191 13.1819 6.50563C13.4456 6.76935 13.5938 7.12704 13.5938 7.5V7.96875M8.1625 3.94375L6.8375 2.61875C6.75045 2.5316 6.64709 2.46245 6.5333 2.41526C6.41952 2.36808 6.29755 2.34378 6.17437 2.34375H2.8125C2.43954 2.34375 2.08185 2.49191 1.81813 2.75563C1.55441 3.01935 1.40625 3.37704 1.40625 3.75V11.25C1.40625 11.623 1.55441 11.9806 1.81813 12.2444C2.08185 12.5081 2.43954 12.6562 2.8125 12.6562H12.1875C12.5605 12.6562 12.9181 12.5081 13.1819 12.2444C13.4456 11.9806 13.5938 11.623 13.5938 11.25V5.625C13.5938 5.25204 13.4456 4.89435 13.1819 4.63063C12.9181 4.36691 12.5605 4.21875 12.1875 4.21875H8.82563C8.57707 4.21853 8.33815 4.11962 8.1625 3.94375Z"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      {:else if /*node.type === "html" || node.type === "doc_embed"*/ true}
        <svg
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="inline stroke-stone-500 w-4 min-w-4"
        >
          <path
            d="M12.1875 8.90625V7.26562C12.1875 6.70618 11.9653 6.16966 11.5697 5.77407C11.1741 5.37849 10.6376 5.15625 10.0781 5.15625H9.14062C8.95414 5.15625 8.7753 5.08217 8.64344 4.95031C8.51158 4.81845 8.4375 4.63961 8.4375 4.45312V3.51562C8.4375 2.95618 8.21526 2.41966 7.81968 2.02407C7.42409 1.62849 6.88757 1.40625 6.32812 1.40625H5.15625M5.15625 9.375H9.84375M5.15625 11.25H7.5M6.5625 1.40625H3.51562C3.1275 1.40625 2.8125 1.72125 2.8125 2.10938V12.8906C2.8125 13.2787 3.1275 13.5938 3.51562 13.5938H11.4844C11.8725 13.5938 12.1875 13.2787 12.1875 12.8906V7.03125C12.1875 5.53941 11.5949 4.10867 10.54 3.05377C9.48508 1.99888 8.05434 1.40625 6.5625 1.40625Z"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      {/if}

      {node.name}
    </div>

    {#if node.isFolder}
      <ul class="pl-2 mt-1">
        <Self parentId={node.id} {allNodesByParent} />
      </ul>
    {/if}
  </li>
{/each}

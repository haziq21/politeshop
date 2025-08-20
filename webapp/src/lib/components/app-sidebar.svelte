<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import * as Collapsible from "$lib/components/ui/collapsible";
  import type { Module, ActivityFolder, AnyActivityWithName } from "../../db";

  interface Props {
    module: Module;
    activities: AnyActivityWithName[];
    activityFolders: ActivityFolder[];
  }

  const { module, activities, activityFolders }: Props = $props();

  type ActivityTreeNode = AnyActivityWithName & { isFolder: false };
  type FolderTreeNode = ActivityFolder & { isFolder: true; children: AnyTreeNode[] };
  type AnyTreeNode = FolderTreeNode | ActivityTreeNode;

  // Build a map of parent IDs to activity / folder nodes
  function buildNodeMap(): Map<string | null | undefined, AnyTreeNode[]> {
    const nodesByParent = new Map<string | null | undefined, AnyTreeNode[]>();

    // Add activity folders as tree nodes
    activityFolders.forEach((folder) => {
      const folderNode: AnyTreeNode = {
        ...folder,
        isFolder: true,
        children: [],
      };

      const parentId = folder.parentId;
      if (!nodesByParent.has(parentId)) {
        nodesByParent.set(parentId, []);
      }
      nodesByParent.get(parentId)!.push(folderNode);
    });

    // Add activities as tree nodes
    activities.forEach((activity) => {
      const activityNode: AnyTreeNode = {
        ...activity,
        isFolder: false,
      };

      const parentId = activity.folderId;
      if (!nodesByParent.has(parentId)) {
        nodesByParent.set(parentId, []);
      }
      nodesByParent.get(parentId)!.push(activityNode);
    });

    // Sort by sortOrder
    nodesByParent.forEach((nodes) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    });

    return nodesByParent;
  }

  const nodesByParent = buildNodeMap();

  function getChildNodes(parentId: string | null | undefined): AnyTreeNode[] {
    return nodesByParent.get(parentId) || [];
  }

  function getActivityIcon(node: AnyTreeNode): string {
    if (node.isFolder) {
      // TODO: Change this
      return `<svg viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-muted-foreground">
        <path d="M1.40625 7.96875V7.5C1.40625 7.12704 1.55441 6.76935 1.81813 6.50563C2.08185 6.24191 2.43954 6.09375 2.8125 6.09375H12.1875C12.5605 6.09375 12.9181 6.24191 13.1819 6.50563C13.4456 6.76935 13.5938 7.12704 13.5938 7.5V7.96875M8.1625 3.94375L6.8375 2.61875C6.75045 2.5316 6.64709 2.46245 6.5333 2.41526C6.41952 2.36808 6.29755 2.34378 6.17437 2.34375H2.8125C2.43954 2.34375 2.08185 2.49191 1.81813 2.75563C1.55441 3.01935 1.40625 3.37704 1.40625 3.75V11.25C1.40625 11.623 1.55441 11.9806 1.81813 12.2444C2.08185 12.5081 2.43954 12.6562 2.8125 12.6562H12.1875C12.5605 12.6562 12.9181 12.5081 13.1819 12.2444C13.4456 11.9806 13.5938 11.623 13.5938 11.25V5.625C13.5938 5.25204 13.4456 4.89435 13.1819 4.63063C12.9181 4.36691 12.5605 4.21875 12.1875 4.21875H8.82563C8.57707 4.21853 8.33815 4.11962 8.1625 3.94375Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }

    return {
      html: "🧑‍🏫",
      doc_embed: "📄",
      video_embed: "▶️",
      web_embed: "🔗",
      submission: "📥",
      quiz: "📝",
      unknown: "❓️",
    }[node.type];
  }
</script>

<!-- Recursive tree snippet -->
{#snippet tree({ parentId }: { parentId: string | null | undefined })}
  {#each getChildNodes(parentId) as node}
    {@const hasChildren = node.isFolder && getChildNodes(node.id).length > 0}

    {#if !node.isFolder}
      <!-- Activity item -->
      <Sidebar.MenuItem>
        <Sidebar.MenuButton class="w-full justify-start gap-2 text-sm">
          {@html getActivityIcon(node)}
          <span class="truncate">{node.name}</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    {:else if !hasChildren}
      <!-- Empty folder -->
      <Sidebar.MenuItem>
        <Sidebar.MenuButton class="w-full justify-start gap-2 text-sm">
          {@html getActivityIcon(node)}
          <span class="truncate">{node.name}</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    {:else}
      <!-- Collapsible folder with children -->
      <Sidebar.MenuItem>
        <Collapsible.Root class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90">
          <Collapsible.Trigger>
            {#snippet child({ props })}
              <Sidebar.MenuButton {...props} class="w-full justify-start gap-2 text-sm">
                <svg
                  viewBox="0 0 15 15"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4 text-muted-foreground transition-transform duration-200"
                >
                  <path
                    d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95642 6.86514 3.15788L10.6151 7.15788C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.565 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z"
                    fill="currentColor"
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                  />
                </svg>
                <!-- {@html getActivityIcon(node)} -->
                <span class="truncate">{node.name}</span>
              </Sidebar.MenuButton>
            {/snippet}
          </Collapsible.Trigger>
          <Collapsible.Content>
            <Sidebar.MenuSub>
              {@render tree({ parentId: node.id })}
            </Sidebar.MenuSub>
          </Collapsible.Content>
        </Collapsible.Root>
      </Sidebar.MenuItem>
    {/if}
  {/each}
{/snippet}

<Sidebar.Root>
  <Sidebar.Content style="scrollbar-color: var(--sidebar-accent) var(--sidebar);">
    <Sidebar.Header>
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          {module.niceName ?? module.name}
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </Sidebar.Header>

    <Sidebar.Group>
      <Sidebar.GroupLabel>Module materials</Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu class="gap-0.5">
          {@render tree({ parentId: null })}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
</Sidebar.Root>

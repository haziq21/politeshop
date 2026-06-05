<script lang="ts">
  import type { ContentFolder } from "$lib/activityTree";
  import type { Module, AnyActivityWithName } from "$lib/server/db";

  import { collectFolderIds } from "$lib/activityTree";
  import * as Collapsible from "$lib/components/ui/collapsible";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { setPreference } from "$lib/preferences";

  interface Props {
    module: Module;
    contentFolders: ContentFolder[];
    openFolderIds: string[];
  }

  const { module, contentFolders, openFolderIds = [] }: Props = $props();

  let openFolders = $derived(new Set(openFolderIds));
  let validFolderIds = $derived(collectFolderIds(contentFolders));

  async function toggleFolder(folderId: string, open: boolean) {
    if (open) {
      openFolders.add(folderId);
    } else {
      openFolders.delete(folderId);
    }

    const ids = [...openFolders].filter((id) => validFolderIds.has(id));
    await setPreference(["openFolders", module.id], ids);
  }

  function getActivityIcon(activity: AnyActivityWithName): string {
    return (
      (
        {
          html: "🧑‍🏫",
          doc_embed: "📄",
          video_embed: "▶️",
          web_embed: "🔗",
          submission: "📥",
          quiz: "📝",
          unknown: "❓️",
        } as Record<string, string>
      )[activity.type] ?? "❓️"
    );
  }
</script>

{#snippet folderIcon()}
  <svg
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="w-4 h-4 shrink-0 text-muted-foreground"
  >
    <path
      d="M1.40625 7.96875V7.5C1.40625 7.12704 1.55441 6.76935 1.81813 6.50563C2.08185 6.24191 2.43954 6.09375 2.8125 6.09375H12.1875C12.5605 6.09375 12.9181 6.24191 13.1819 6.50563C13.4456 6.76935 13.5938 7.12704 13.5938 7.5V7.96875M8.1625 3.94375L6.8375 2.61875C6.75045 2.5316 6.64709 2.46245 6.5333 2.41526C6.41952 2.36808 6.29755 2.34378 6.17437 2.34375H2.8125C2.43954 2.34375 2.08185 2.49191 1.81813 2.75563C1.55441 3.01935 1.40625 3.37704 1.40625 3.75V11.25C1.40625 11.623 1.55441 11.9806 1.81813 12.2444C2.08185 12.5081 2.43954 12.6562 2.8125 12.6562H12.1875C12.5605 12.6562 12.9181 12.5081 13.1819 12.2444C13.4456 11.9806 13.5938 11.623 13.5938 11.25V5.625C13.5938 5.25204 13.4456 4.89435 13.1819 4.63063C12.9181 4.36691 12.5605 4.21875 12.1875 4.21875H8.82563C8.57707 4.21853 8.33815 4.11962 8.1625 3.94375Z"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
{/snippet}

{#snippet chevronIcon()}
  <svg
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200"
  >
    <path
      d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95642 6.86514 3.15788L10.6151 7.15788C10.7954 7.3502 10.7954 7.64949 10.6151 7.84182L6.86514 11.8418C6.67627 12.0433 6.35985 12.0535 6.1584 11.8646C5.95694 11.6757 5.94673 11.3593 6.1356 11.1579L9.565 7.49985L6.1356 3.84182C5.94673 3.64036 5.95694 3.32394 6.1584 3.13508Z"
      fill="currentColor"
      fill-rule="evenodd"
      clip-rule="evenodd"
    />
  </svg>
{/snippet}

{#snippet tree(items: (AnyActivityWithName | ContentFolder)[])}
  {#each items as item}
    {#if item.type === "folder"}
      {#if item.contents.length === 0}
        <Sidebar.MenuItem>
          <Sidebar.MenuButton class="w-full justify-start gap-2 text-sm">
            {@render folderIcon()}
            <span class="truncate">{item.name}</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      {:else}
        <Sidebar.MenuItem>
          <Collapsible.Root
            class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
            open={openFolders.has(item.id)}
            onOpenChange={async (open) => await toggleFolder(item.id, open)}
          >
            <Collapsible.Trigger>
              {#snippet child({ props })}
                <Sidebar.MenuButton {...props} class="w-full justify-start gap-2 text-sm">
                  {@render chevronIcon()}
                  <span class="truncate">{item.name}</span>
                </Sidebar.MenuButton>
              {/snippet}
            </Collapsible.Trigger>
            <Collapsible.Content>
              <Sidebar.MenuSub>
                {@render tree(item.contents)}
              </Sidebar.MenuSub>
            </Collapsible.Content>
          </Collapsible.Root>
        </Sidebar.MenuItem>
      {/if}
    {:else}
      <Sidebar.MenuItem>
        <Sidebar.MenuButton class="w-full justify-start gap-2 text-sm">
          {#snippet child({ props })}
            <a
              href="/d2l/le/enhancedSequenceViewer/{module.id}?url={encodeURIComponent(
                `https://sequences.api.brightspace.com/${module.id}/activity/${item.id}`,
              )}"
              {...props}
            >
              <span class="shrink-0">{getActivityIcon(item)}</span>
              <span class="truncate">{item.name}</span>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
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
          {@render tree(contentFolders)}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
</Sidebar.Root>

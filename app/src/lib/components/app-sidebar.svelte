<script lang="ts">
  import type { ContentFolder } from "$lib/activityTree";
  import type { Module, AnyActivityWithName } from "$lib/server/db";
  import type { Snippet } from "svelte";

  import { collectFolderIds } from "$lib/activityTree";
  import FadeText from "$lib/components/fade-text.svelte";
  import { setPreference } from "$lib/preferences";
  import { Collapsible } from "bits-ui";

  interface Props {
    module: Module;
    contentFolders: ContentFolder[];
    openFolderIds: string[];
    currentActivityId?: string;
  }

  const { module, contentFolders, openFolderIds = [], currentActivityId }: Props = $props();

  let scrolled = $state(false);
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

{#snippet backIcon()}
  <svg
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="w-6 h-6 shrink-0 group-hover/header:animate-[nudge-left_0.2s_ease-out_forwards]"
  >
    <path
      d="M8.84182 3.13514C9.04327 3.32401 9.05348 3.64042 8.86462 3.84188L5.43521 7.49991L8.86462 11.1579C9.05348 11.3594 9.04327 11.6758 8.84182 11.8647C8.64036 12.0535 8.32394 12.0433 8.13508 11.8419L4.38508 7.84188C4.20477 7.64955 4.20477 7.35027 4.38508 7.15794L8.13508 3.15794C8.32394 2.95648 8.64036 2.94628 8.84182 3.13514Z"
      fill="currentColor"
      fill-rule="evenodd"
    />
  </svg>
{/snippet}

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

{#snippet menuItem(
  label: Snippet,
  { href, active, ...props }: { href?: string; active?: boolean; [key: string]: unknown } = {},
)}
  <svelte:element
    this={href ? "a" : "button"}
    {href}
    data-active={active}
    {...props}
    class="outline-hidden ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium flex h-8 w-full items-center justify-start gap-2 overflow-hidden rounded-md p-2 text-left text-sm focus-visible:ring-2 group/btn"
  >
    <span class="flex items-center gap-2 flex-1 min-w-0 transition-transform group-active/btn:translate-y-px">
      {@render label()}
    </span>
  </svelte:element>
{/snippet}

{#snippet folderLabel(icon: Snippet, name: string)}
  {@render icon()}
  <FadeText text={name} class="flex-1 min-w-0" />
{/snippet}

{#snippet tree(items: (AnyActivityWithName | ContentFolder)[])}
  {#each items as item}
    {#if item.type === "folder"}
      {#if item.contents.length === 0}
        <li class="relative">
          {#snippet label()}{@render folderLabel(folderIcon, item.name)}{/snippet}
          {@render menuItem(label)}
        </li>
      {:else}
        <li class="relative">
          <Collapsible.Root
            class="group/collapsible [&[data-state=open]>button>span>svg:first-child]:rotate-90"
            open={openFolders.has(item.id)}
            onOpenChange={async (open) => await toggleFolder(item.id, open)}
          >
            <Collapsible.Trigger>
              {#snippet child({ props })}
                {#snippet label()}{@render folderLabel(chevronIcon, item.name)}{/snippet}
                {@render menuItem(label, props)}
              {/snippet}
            </Collapsible.Trigger>
            <Collapsible.Content>
              <ul class="flex min-w-0 translate-x-px flex-col gap-0.5 pl-2.5 py-0.5">
                {@render tree(item.contents)}
              </ul>
            </Collapsible.Content>
          </Collapsible.Root>
        </li>
      {/if}
    {:else}
      <li class="relative">
        {#snippet label()}
          <span class="shrink-0">{getActivityIcon(item)}</span>
          <FadeText text={item.name} class="flex-1 min-w-0" />
        {/snippet}
        {@render menuItem(label, {
          href: `/d2l/le/enhancedSequenceViewer/${module.id}?url=${encodeURIComponent(
            `https://sequences.api.brightspace.com/${module.id}/activity/${item.id}`,
          )}`,
          active: item.id === currentActivityId,
        })}
      </li>
    {/if}
  {/each}
{/snippet}

<div class="text-sidebar-foreground hidden md:block">
  <!-- Reserves the sidebar's width in the flex layout -->
  <div class="w-(--sidebar-width) relative"></div>
  <div class="w-(--sidebar-width) fixed inset-y-0 left-0 z-10 flex h-svh border-r">
    <div class="bg-sidebar flex h-full w-full flex-col">
      <div
        class="flex flex-col gap-2 p-4 border-b transition-colors {scrolled
          ? 'border-sidebar-border'
          : 'border-transparent'}"
      >
        <a
          href="/d2l/home"
          class="group/header flex items-center gap-3 rounded-lg transition-transform active:translate-y-px"
        >
          <div class="relative w-9 h-9 rounded-md overflow-hidden shrink-0">
            <img
              src={module.imageIconURL}
              alt=""
              draggable="false"
              class="w-full h-full object-cover transition-opacity group-hover/header:opacity-0"
            />
            <div
              class="absolute inset-0 flex items-center justify-center border border-sidebar-border rounded-md opacity-0 transition-opacity group-hover/header:opacity-100"
            >
              {@render backIcon()}
            </div>
          </div>
          <div class="relative flex-1 min-w-0 h-9 flex flex-col justify-center overflow-hidden">
            <div class="transition-opacity group-hover/header:opacity-0">
              <p
                class="text-base font-bold text-stone-100 leading-none whitespace-nowrap overflow-hidden text-ellipsis"
              >
                {module.niceCode || module.code}
              </p>
              <p class="text-xs text-stone-300 leading-none mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                {module.niceName || module.name}
              </p>
            </div>
            <p
              class="absolute inset-0 flex items-center text-sm text-stone-200 opacity-0 transition-opacity group-hover/header:opacity-100 whitespace-nowrap"
            >
              Back to home
            </p>
          </div>
        </a>
      </div>

      <div
        class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto"
        style="scrollbar-color: var(--sidebar-accent) var(--sidebar);"
        onscroll={(e) => (scrolled = (e.target as HTMLElement).scrollTop > 0)}
      >
        <div class="relative flex w-full min-w-0 flex-col p-2">
          <div
            class="text-stone-400 ring-sidebar-ring outline-hidden flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-semibold"
          >
            Module materials
          </div>
          <div class="w-full text-sm">
            <ul class="flex w-full min-w-0 flex-col gap-0.5">
              {@render tree(contentFolders)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

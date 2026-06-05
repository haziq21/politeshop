<script lang="ts">
  import WithSidebar from "$lib/components/with-sidebar.svelte";
  import { getPreferences, type Preferences } from "$lib/preferences.js";
  import { onMount } from "svelte";

  import { syncModule } from "./sync.remote";

  let { children, data } = $props();

  type SyncedData = Awaited<ReturnType<typeof syncModule>>;
  let synced = $state<SyncedData | null>(null);
  let prefs = $state<Preferences | null>(null);

  let contentFolders = $derived(synced?.contentFolders ?? data.contentFolders);
  let openFolderIds = $derived(prefs?.openFolders?.[data.module.id] ?? []);

  onMount(async () => {
    prefs = await getPreferences();
    synced = await syncModule({ moduleId: data.module.id });
  });
</script>

<WithSidebar module={data.module} {contentFolders} {openFolderIds}>
  {@render children()}
</WithSidebar>

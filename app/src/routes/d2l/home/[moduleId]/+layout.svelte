<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";

  import WithSidebar from "#lib/components/with-sidebar.svelte";
  import { getPreferences, type Preferences } from "#lib/preferences.ts";

  import { syncModule } from "./sync.remote";

  let { children, data } = $props();

  type SyncedData = Awaited<ReturnType<typeof syncModule>>;
  let synced = $state<SyncedData | null>(null);
  let prefs = $state<Preferences | null>(null);

  let activities = $derived(synced?.activities ?? data.activities);
  let openFolderIds = $derived(prefs?.openFolders?.[data.module.id] ?? []);

  onMount(async () => {
    prefs = await getPreferences();
    synced = await syncModule({ moduleId: data.module.id });
  });
</script>

<WithSidebar module={data.module} {activities} {openFolderIds} currentActivityId={page.params.activityId}>
  {@render children()}
</WithSidebar>

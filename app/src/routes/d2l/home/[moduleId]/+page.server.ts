import type { PageServerLoad } from "./$types";
import * as queries from "$lib/server/db/queries";
import type {
  ActivityFolder as DBActivityFolder,
  AnyActivityWithName,
} from "$lib/server/db";
import type { ContentFolder } from "$lib/content";

function buildTree(
  dbFolders: DBActivityFolder[],
  dbActivities: AnyActivityWithName[],
  parentId: string | null | undefined,
): ContentFolder[] {
  return dbFolders
    .filter((f) => f.parentId === parentId)
    .map((f) => ({
      type: "folder" as const,
      id: f.id,
      name: f.name,
      description: f.description ?? "",
      sortOrder: f.sortOrder,
      contents: [
        ...buildTree(dbFolders, dbActivities, f.id),
        ...dbActivities.filter((a) => a.folderId === f.id),
      ].sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export const load: PageServerLoad = async ({ params }) => {
  const { moduleId } = params;
  const [module, activityFolders, activities] = await Promise.all([
    queries.getModule(moduleId),
    queries.getActivityFolders(moduleId),
    queries.getActivities(moduleId),
  ]);

  const contentFolders = buildTree(activityFolders, activities, null);

  return { module, contentFolders };
};

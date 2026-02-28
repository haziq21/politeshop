import type {
  ActivityFolder,
  AnyActivity,
  AnyActivityWithName,
} from "$lib/server/db";
import type * as politelib from "@politeshop/lib";

/**
 * Recursive content tree node that mirrors the library's {@link ActivityFolder}
 * type, but uses {@link AnyActivityWithName} so activity names are always
 * available (including for submission / quiz activities whose names are joined
 * from related tables).
 */
export type ContentFolder = {
  type: "folder";
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  contents: (AnyActivityWithName | ContentFolder)[];
};

/**
 * Recursively flatten a tree of {@link politelib.ActivityFolder}s (as returned by
 * `POLITELib.getModuleContent`) into the flat arrays that the DB expects.
 */
export function flattenActivityTree(
  folders: politelib.ActivityFolder[],
  moduleId: string,
  parentId: string | null = null,
): { folders: ActivityFolder[]; activities: AnyActivity[] } {
  const flatFolders: ActivityFolder[] = [];
  const flatActivities: AnyActivity[] = [];

  for (const folder of folders) {
    flatFolders.push({
      id: folder.id,
      name: folder.name,
      description: folder.description,
      parentId,
      moduleId,
      sortOrder: folder.sortOrder,
    });

    for (const item of folder.contents) {
      if (item.type === "folder") {
        const sub = flattenActivityTree([item], moduleId, folder.id);
        flatFolders.push(...sub.folders);
        flatActivities.push(...sub.activities);
      } else {
        flatActivities.push({ ...item, folderId: folder.id });
      }
    }
  }

  return { folders: flatFolders, activities: flatActivities };
}

/**
 * Reconstruct a {@link ContentFolder} tree from the flat DB records produced
 * by {@link flattenActivityTree}.
 */
export function unflattenActivityTree(
  folders: ActivityFolder[],
  activities: AnyActivityWithName[],
  parentId: string | null = null,
): ContentFolder[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .map((f) => ({
      type: "folder" as const,
      id: f.id,
      name: f.name,
      description: f.description ?? "",
      sortOrder: f.sortOrder,
      contents: [
        ...unflattenActivityTree(folders, activities, f.id),
        ...activities.filter((a) => a.folderId === f.id),
      ].sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

import type { ActivityFolder, AnyActivityWithName } from "./db";

export type ActivityTreeNode = AnyActivityWithName & { isFolder: false };
export type FolderTreeNode = ActivityFolder & { isFolder: true; children: AnyTreeNode[] };
export type AnyTreeNode = FolderTreeNode | ActivityTreeNode;

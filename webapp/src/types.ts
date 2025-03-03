import type { ActivityFolder, AnyActivity } from "./db";

export type Result<T> =
  | { data: T; error: null }
  | {
      data: null;
      error: { msg: string; data?: Object };
    };

export type ActivityTreeNode = AnyActivity & { isFolder: false };
export type FolderTreeNode = ActivityFolder & { isFolder: true; children: AnyTreeNode[] };
export type AnyTreeNode = FolderTreeNode | ActivityTreeNode;

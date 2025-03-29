import type { ActivityFolder, AnyActivityWithName } from "./db";

export type Result<T> =
  | { data: T; error: null }
  | {
      data: null;
      error: { msg: string; data?: any };
    };

export type Awaitable<T> = T | Promise<T>;

export type ActivityTreeNode = AnyActivityWithName & { isFolder: false };
export type FolderTreeNode = ActivityFolder & { isFolder: true; children: AnyTreeNode[] };
export type AnyTreeNode = FolderTreeNode | ActivityTreeNode;

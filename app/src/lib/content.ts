import type { AnyActivityWithName } from "$lib/server/db";

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

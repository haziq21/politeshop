import { unflattenActivityTree } from "$lib/activityTree";
import * as queries from "$lib/server/db/queries";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ params }) => {
  const { moduleId } = params;
  const [module, activityFolders, activities] = await Promise.all([
    queries.getModule(moduleId),
    queries.getActivityFolders(moduleId),
    queries.getActivities(moduleId),
  ]);

  return {
    module,
    contentFolders: unflattenActivityTree(activityFolders, activities),
  };
};

import type { PageServerLoad } from "./$types";
import * as queries from "$lib/server/db/queries";
import { unflattenActivityTree } from "$lib/activityTree";

export const load: PageServerLoad = async ({ params }) => {
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

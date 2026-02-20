import type { PageServerLoad } from "./$types";
import * as queries from "$lib/server/db/queries";

export const load: PageServerLoad = async ({ locals, params }) => {
  const sessionHash = locals.sessionHash;
  const user = await queries.getUserFromSessionHash(sessionHash);
  const userId = user!.id;
  const { moduleId } = params;

  const [mod, activityFolders, activities] = await Promise.all([
    queries.getModule(moduleId),
    queries.getActivityFolders(moduleId),
    queries.getActivities(moduleId),
  ]);

  return {
    module: mod,
    activityFolders,
    activities,
  };
};

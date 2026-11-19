import * as queries from "#lib/server/db/queries.ts";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ params, locals }) => {
  const { moduleId } = params;
  const user = await queries.getUserFromSessionHash(locals.sessionHash);
  const [module, activities] = await Promise.all([
    queries.getModule(moduleId),
    queries.getBaseActivities(user!.id, moduleId),
  ]);

  return { module, activities };
};

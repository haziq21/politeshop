import * as queries from "#lib/server/db/queries.ts";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ params }) => {
  const { moduleId } = params;
  const [module, activities] = await Promise.all([queries.getModule(moduleId), queries.getBaseActivities(moduleId)]);

  return { module, activities };
};

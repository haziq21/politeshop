import { getRequestEvent, query } from "$app/server";
import { unflattenActivityTree } from "$lib/activityTree";
import * as queries from "$lib/server/db/queries";
import { syncAssessments, syncModuleContent } from "$lib/server/sync";
import { z } from "zod";

export const syncModule = query(z.object({ moduleId: z.string() }), async ({ moduleId }) => {
  const { pl, sessionHash } = getRequestEvent().locals;

  const user = await queries.getUserFromSessionHash(sessionHash);
  const userId = user!.id;

  const organization = await queries.getOrganization(userId);

  await Promise.all([
    syncAssessments(pl, { userId, organizationId: organization.id, moduleId }),
    syncModuleContent(pl, { userId, moduleId, stubReferencedAssessments: true }),
  ]);

  const [activityFolders, activities] = await Promise.all([
    queries.getActivityFolders(moduleId),
    queries.getActivities(moduleId),
  ]);

  return { contentFolders: unflattenActivityTree(activityFolders, activities) };
});

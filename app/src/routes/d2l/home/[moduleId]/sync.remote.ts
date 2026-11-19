import { getRequestEvent, query } from "$app/server";
import { z } from "zod";

import * as queries from "#lib/server/db/queries.ts";
import { syncAssessments, syncModuleActivities } from "#lib/server/sync.ts";

export const syncModule = query(z.object({ moduleId: z.string() }), async ({ moduleId }) => {
  const { pl, sessionHash } = getRequestEvent().locals;

  const user = await queries.getUserFromSessionHash(sessionHash);
  const userId = user!.id;

  const organization = await queries.getOrganization(userId);

  await Promise.all([
    syncAssessments(pl, { userId, organizationId: organization.id, moduleId }),
    syncModuleActivities(pl, { userId, moduleId, stubReferencedAssessments: true }),
  ]);

  return { activities: await queries.getBaseActivities(moduleId) };
});

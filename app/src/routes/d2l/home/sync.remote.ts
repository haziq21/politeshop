import { getRequestEvent, query } from "$app/server";

import * as queries from "#lib/server/db/queries.ts";
import {
  syncAssessments,
  syncModuleNames,
  syncModulesAndSemesters,
  syncOrganization,
  syncUser,
} from "#lib/server/sync.ts";
import { logger } from "#lib/utils.ts";

export const sync = query(async () => {
  const { pl, sessionHash } = getRequestEvent().locals;

  const user = (await queries.getUserFromSessionHash(sessionHash))!;
  const userId = user.id;

  const [, , uglyModules] = await Promise.all([
    syncOrganization(pl),
    syncUser(pl, { sessionHash, organizationId: user.organizationId }),
    syncModulesAndSemesters(pl, { userId }),
  ]);
  await syncModuleNames(uglyModules, { userId });

  const modules = await queries.getModules(userId);
  const results = await Promise.allSettled(
    modules.map((m) => syncAssessments(pl, { userId, organizationId: user.organizationId, moduleId: m.id })),
  );
  for (const r of results) {
    if (r.status === "rejected") logger.warn({ err: r.reason }, "Failed to sync a module's due dates");
  }

  const [organization, semesters, dueItems] = await Promise.all([
    queries.getOrganization(userId),
    queries.getSemesters(userId),
    queries.getDueItems(userId),
  ]);

  return {
    organization,
    semesters: semesters.sort((a, b) => b.name.localeCompare(a.name)),
    modules,
    dueItems,
  };
});

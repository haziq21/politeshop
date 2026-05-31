import type { SubmissionDropbox, UserSubmission } from "$lib/server/db";

import { getRequestEvent, query } from "$app/server";
import { flattenActivityTree, unflattenActivityTree } from "$lib/activityTree";
import * as queries from "$lib/server/db/queries";
import { z } from "zod";

export const syncModule = query(z.object({ moduleId: z.string() }), async ({ moduleId }) => {
  const { pl, sessionHash } = getRequestEvent().locals;

  const user = await queries.getUserFromSessionHash(sessionHash);
  const userId = user!.id;

  const organization = await queries.getOrganization(userId);

  const [moduleContents, quizzes, [dropboxes, userSubs]] = await Promise.all([
    pl.getModuleContent({ moduleId }),
    pl.getQuizzes({ moduleId }),
    pl.getSubmissionDropboxes({ moduleId }).then(async (dropboxes) => {
      const userSubs = await Promise.all(
        dropboxes.map((d) =>
          pl
            .getSubmissions({
              moduleId,
              dropboxId: d.id,
              organizationId: organization.id,
            })
            .then((subs) => subs.map((s) => ({ ...s, userId }))),
        ),
      );
      return [dropboxes, userSubs.flat()] as [SubmissionDropbox[], UserSubmission[]];
    }),
  ]);

  const { folders: allFolders, activities: allActivities } = flattenActivityTree(moduleContents, moduleId);

  await queries.upsertQuizzes(quizzes);
  await queries.upsertSubmissionDropboxes(dropboxes);
  await queries.upsertUserSubmissions(userSubs);
  await queries.upsertActivityFolders(allFolders);
  await queries.upsertActivities(allActivities);

  const [activityFolders, activities] = await Promise.all([
    queries.getActivityFolders(moduleId),
    queries.getActivities(moduleId),
  ]);

  return { contentFolders: unflattenActivityTree(activityFolders, activities) };
});

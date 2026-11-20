import { error } from "@sveltejs/kit";

import * as queries from "#lib/server/db/queries.ts";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
  const user = await queries.getUserFromSessionHash(locals.sessionHash);
  const activity = await queries.getActivity(user!.id, params.activityId);

  if (!activity || activity.type === "folder") {
    throw error(404, `Activity ${params.activityId} not found`);
  }

  return {
    activity,
  };
};

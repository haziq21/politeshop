import type { PageServerLoad } from "./$types";
import * as queries from "$lib/server/db/queries";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
  const activity = await queries.getActivity(params.activityId);

  if (!activity) {
    throw error(404, `Activity ${params.activityId} not found`);
  }

  return {
    activity,
  };
};

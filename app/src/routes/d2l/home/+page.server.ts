import type { PageServerLoad } from "./$types";
import * as queries from "$lib/server/db/queries";

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const user = await queries.getUserFromSessionHash(locals.sessionHash);
  const userId = user!.id;

  const [organization, semesters, modules, semesterBreak] = await Promise.all([
    queries.getOrganization(userId),
    queries.getSemesters(userId),
    queries.getModules(userId),
    queries.currentOrNextSemesterBreak(userId),
  ]);

  const defaultSemester = cookies.get("defaultSemester") ?? "all";

  return {
    organization,
    semesters: semesters.sort((a, b) => b.name.localeCompare(a.name)),
    modules,
    defaultSemester,
    semesterBreak,
  };
};

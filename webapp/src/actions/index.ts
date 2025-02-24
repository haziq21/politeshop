import { ActionError, defineAction } from "astro:actions";
import type { POLITEMallClient } from "../politemall";
import type { school, semester, module } from "../db";

async function fetchPartialUser(polite: POLITEMallClient): Promise<{ id: string; name: string }> {
  const { data, error } = await polite.fetchPartialUser();
  if (error) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch user from POLITEMall" });
  return data;
}

async function fetchSchool(polite: POLITEMallClient): Promise<typeof school.$inferInsert> {
  const { data, error } = await polite.fetchSchool();
  if (error)
    throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch school from POLITEMall" });
  return data;
}

async function fetchSemesters(polite: POLITEMallClient): Promise<(typeof semester.$inferInsert)[]> {
  const { data, error } = await polite.fetchSemesters();
  if (error)
    throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch semesters from POLITEMall" });
  return data;
}

async function fetchModules(polite: POLITEMallClient): Promise<(typeof module.$inferInsert)[]> {
  const { data, error } = await polite.fetchModules();
  if (error)
    throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch modules from POLITEMall" });
  return data;
}

export const server = {
  registerUser: defineAction({
    handler: async (input, context) => {
      const polite = context.locals.polite;
      const ds = context.locals.datastore;

      console.log("registerUser(): Fetching basic data from POLITEMall...");
      let fetchStart = Date.now();

      const [partialUserData, schoolData, semestersData, modulesData] = await Promise.all([
        fetchPartialUser(polite),
        fetchSchool(polite),
        fetchSemesters(polite),
        fetchModules(polite),
      ]);

      console.log(`registerUser(): Fetched basic data in ${Date.now() - fetchStart}ms`);

      // Update the database with the fetched data
      const fullUserData = { ...partialUserData, schoolId: schoolData.id };
      // TODO: Parallelize these too?
      await ds.insertSchool(schoolData);
      await ds.insertUser(fullUserData);
      await ds.insertSemesters(semestersData);
      await ds.insertAndAssociateModules(modulesData);

      fetchStart = Date.now();
      console.log("registerUser(): Fetching module content from POLITEMall...");

      // Fetch all module content in parallel
      await Promise.all(
        modulesData.map(async ({ id }) => {
          let res;

          try {
            res = await polite.fetchModuleContent(id);
          } catch (e) {
            console.dir(e, { depth: null });
            throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch module content" });
          }

          const { data, error } = res;

          if (error) {
            console.dir(error, { depth: null });
            throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch module content" });
          }

          try {
            await ds.insertActivityFolders(data.activityFolders);
            await ds.insertActivities(data.activities);
          } catch (e) {
            console.dir(e, { depth: null });
            throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to insert module content" });
          }
        })
      );

      console.log(`registerUser(): Fetched module content in ${Date.now() - fetchStart}ms`);
    },
  }),
};

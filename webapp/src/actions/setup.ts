import { defineAction } from "astro:actions";
import { logger } from "../utils";
import type { Module, SubmissionDropbox, UserSubmission } from "../db";
import { GEMINI_API_KEY } from "astro:env/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

export const initUser = defineAction({
  handler: async (_, context) => {
    try {
      const { polite, repo, sessionHash } = context.locals;

      // Fetch all the data in parallel
      const [partialUser, organization, { modules, semesters }] = await Promise.all([
        polite.fetchPartialUser(),
        polite.fetchOrganization(),
        polite.fetchModulesAndSemesters(),
      ]);

      // Update the database with the fetched data
      await repo.upsertOrganization(organization);
      await repo.upsertUser({ ...partialUser, sessionHash, organizationId: organization.id });
      await repo.upsertSemesters(semesters);
      const uglyModules = await repo.upsertAndAssociateModules(modules);

      // Rename ugly modules with GenAI
      if (uglyModules.length > 0) {
        logger.info(`Renaming ${uglyModules.length} modules...`);
        const renamedModules = await renameModules(uglyModules);
        await repo.upsertAndAssociateModules(renamedModules);
      }

      // Fetch everything in parallel
      const [moduleContents, quizzes, [dropboxes, userSubs]] = await Promise.all([
        Promise.all(modules.map((m) => polite.fetchModuleContent(m.id))),
        Promise.all(modules.map((m) => polite.fetchQuizzes(m.id))),
        Promise.all(
          modules.map(async (m): Promise<[SubmissionDropbox[], UserSubmission[]]> => {
            const dropboxes = await polite.fetchSubmissionDropboxes(m.id);

            const userSubs = await Promise.all(
              dropboxes.map((d) =>
                polite.fetchUserSubmissions(m.id, d.id, {
                  dropboxIsClosed: (!!d.closesAt && d.closesAt < new Date()) || (!!d.opensAt && new Date() < d.opensAt),
                  organizationId: organization.id,
                })
              )
            );

            return [dropboxes, userSubs.flat()];
          })
        ).then((res) => [res.flatMap(([d, _]) => d), res.flatMap(([_, s]) => s)] as const),
      ]);

      // Upsert the module content into the database
      await repo.upsertQuizzes(quizzes.flat());
      await repo.upsertSubmissionDropboxes(dropboxes);
      await repo.upsertUserSubmissions(userSubs);
      await repo.upsertActivityFolders(moduleContents.flatMap((m) => m.activityFolders));
      await repo.upsertActivities(moduleContents.flatMap((m) => m.activities));
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
});

async function renameModules(modules: Module[]): Promise<Module[]> {
  const google = createGoogleGenerativeAI({
    apiKey: GEMINI_API_KEY,
  });

  const { object } = await generateObject({
    model: google("models/gemini-2.5-flash-lite"),
    output: "array",
    schema: z.object({
      niceCode: z.string(),
      niceName: z.string(),
    }),
    temperature: 0,
    prompt: moduleRenamePrompt(modules),
    experimental_providerMetadata: {
      google: {
        thinkingConfig: {
          temperature: 0,
          thinkingBudget: 0,
        },
      },
    },
  });

  logger.info(moduleRenamePrompt(modules));

  return modules.map((module, i) => ({
    ...module,
    niceCode: object[i].niceCode,
    niceName: object[i].niceName,
  }));
}

const moduleRenamePrompt = (
  modules: Module[]
) => `Each JSON object in the array below describes the name and code of a module offered by a Polytechnic in Singapore. Output a corresponding array of JSON objects with each object containing the string fields "niceName" and "niceCode".

Step 1: For "niceName" field:
- Convert the module name to Proper Title Case, except for camelCased words - those should be preserved as-is
- Remove any text in parentheses including the parentheses themselves
- Preserve acronyms like "IT", "NP", "SP" in ALL CAPS

Step 2: For "niceCode" field:
- Start by identifying core module codes in the "code" field
- Remove all numeric codes (like "011846", "009588")
- Remove all year/semester prefixes (like "24S1-", "21S2-")
- Remove department prefixes when followed by more specific identifiers
- If multiple identifiers exist (separated by "/"), use only the core identifiers separated by "/"

Examples of "niceCode" extraction (with original code and name):
- Code: "22S1-IS_PLP_NP", Name: "Personalised Learning Pathway (PLP)" → niceCode: "PLP" (not "PLP_NP")
- Code: "21S2-CLTE_Stud_eTest_Guide", Name: "Student eProctored Tests Guide" → niceCode: "eTest_Guide" (not "Stud_eTest_Guide")
- Code: "24S1-LIB_DIGITAL_TK", Name: "Digital Toolkit & Library Updates" → niceCode: "DIGITAL_TK"
- Code: "24S1-1_CM_011846", Name: "z_[Archived - 24S1] COMPUTING MATHEMATICS(1_CM_011846)" → niceCode: "CM" (remove the numeric code)
- Code: "24S1-SAS_PHP", Name: "z_[Archived - 24S1] Level 1 Peer Helping Programme" → niceCode: "PHP"
- Code: "24S1-OIC_FinLit1_ICT", Name: "z_[Archived - 24S1] Financial Literacy Module 1 (ICT Apr)" → niceCode: "FinLit1" (not "FinLit1_ICT")
- Code: "24S1-LIB_DIGITALLIFE_ICT", Name: "Digital Life @ Polys: Digital & Media Literacy, Cyber Wellness, Anti-Plagiarism, Copyright, Campus Wellness (ICT)" → niceCode: "DIGITALLIFE" (not "DIGITALLIFE_ICT")
- Code: "24S1-ICT_Stud_DipIT", Name: "Diploma in IT" → niceCode: "DipIT" (not "Stud_DipIT")
- Code: "24S2-1_ID_009807", Name: "Interactive Development / Front End Development(1_ID_009807 / 3_FED_013851)" → niceCode: "ID/FED" (not "ID_009807/FED_013851")

Focus on extracting only the most essential identifiers that directly relate to the module name, without any numeric codes or department prefixes.

${JSON.stringify(modules.map(({ code, name }) => ({ code, name })))}`;

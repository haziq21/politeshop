import { setDefaultSemesterFilter } from "./defaults";
import { ActionError, defineAction } from "astro:actions";
import type { POLITEMallClient } from "../politemall";
import type { school, semester, module, Module, ActivityFolder, AnyActivity, UserSubmission } from "../db";
import { GEMINI_API_KEY } from "astro:env/server";
import { GoogleGenerativeAI, SchemaType, type GenerationConfig } from "@google/generative-ai";
import { getPOLITEShopJWT } from "./auth";
import { unwrapResults } from "../helpers";

const GEMINI_MODULE_RENAME_PROMPT = `Each JSON object in the array below describes the name and code of a module offered by a Polytechnic in Singapore. Output a corresponding array of JSON objects with each object containing the string fields "niceName" and "niceCode".

Step 1: For "niceName" field:
- Convert the module name to proper title case, except for camelCased words - those should be preserved as-is
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

Focus on extracting only the most essential identifiers that directly relate to the module name, without any numeric codes or department prefixes. Output only the JSON array in a minified form, as plain text with no other text or markdown formatting.

`;

async function renameModules(modules: Module[]): Promise<Module[]> {
  const generationConfig: GenerationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          niceCode: { type: SchemaType.STRING },
          niceName: { type: SchemaType.STRING },
        },
        required: ["niceCode", "niceName"],
      },
    },
  };

  const fullPrompt = GEMINI_MODULE_RENAME_PROMPT + JSON.stringify(modules.map(({ code, name }) => ({ code, name })));

  const result = await new GoogleGenerativeAI(GEMINI_API_KEY!)
    .getGenerativeModel({ model: "gemini-2.0-flash" })
    .startChat({ generationConfig })
    .sendMessage(fullPrompt);

  // I'm trusting that the result does in fact follow the schema
  const jsonResult = JSON.parse(result.response.text()) as { niceCode: string; niceName: string }[];

  return modules.map((module, i) => ({
    ...module,
    niceCode: jsonResult[i].niceCode,
    niceName: jsonResult[i].niceName,
  }));
}

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
  getPOLITEShopJWT,
  setDefaultSemesterFilter,

  // TODO: Return changed data
  syncData: defineAction({
    handler: async (_, context) => {
      const polite = context.locals.polite;
      const repo = context.locals.repo;

      // Fetch all the data in parallel
      const { data, error } = await unwrapResults([
        polite.fetchPartialUser(),
        polite.fetchSchool(),
        polite.fetchSemesters(),
        polite.fetchModules(),
      ]);
      if (error) {
        console.dir(error, { depth: null });
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "POLITEMall API call failed" });
      }
      const [partialUser, school, semesters, modules] = data;

      // Update the database with the fetched data
      const fullUserData = { ...partialUser, schoolId: school.id };
      await repo.upsertSchool(school);
      await repo.upsertUser(fullUserData);
      await repo.upsertSemesters(semesters);
      const uglyModules = await repo.upsertAndAssociateModules(modules);

      // Rename ugly modules with GenAI
      if (uglyModules.length > 0) {
        console.log(`syncData(): Renaming ${uglyModules.length} modules...`);
        const renamedModules = await renameModules(uglyModules);
        await repo.upsertAndAssociateModules(renamedModules);
      }

      let fetchStart = Date.now();
      console.log("syncData(): Fetching module content from POLITEMall...");

      // Fetch everything in parallel
      const { data: fetchResult, error: fetchError } = await unwrapResults([
        unwrapResults(modules.map(({ id }) => polite.fetchModuleContent(id))),
        unwrapResults(modules.map(({ id }) => polite.fetchSubmissionDropboxes(id))),
        unwrapResults(modules.map(({ id }) => polite.fetchQuizzes(id))),
      ]);
      if (fetchError) {
        console.dir(fetchError, { depth: null });
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "POLITEMall API call failed" });
      }
      const [moduleContents, submissionsDropboxes, quizzes] = fetchResult;

      console.log(`syncData(): Fetched module content in ${Date.now() - fetchStart}ms`);

      // Flatten the module data
      const activities = moduleContents.flatMap((m) => m.activities);
      const activityFolders = moduleContents.flatMap((m) => m.activityFolders);

      // const { data: assignmentSubmissions, error: error3 } = await unwrapResults(
      //   moduleContents.flatMap(({ activities }, i) =>
      //     activities
      //       .filter((act) => act.type === "submission")
      //       .map((act) => polite.fetchUserSubmissions(modules[i].id, act.id))
      //   )
      // );
      // if (error3) {
      //   console.dir(error3, { depth: null });
      //   throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "POLITEMall API call failed" });
      // }

      // Upsert the module content into the database
      try {
        await repo.upsertSubmissionDropboxes(submissionsDropboxes.flat());
        await repo.upsertQuizzes(quizzes.flat());
        await repo.upsertActivityFolders(activityFolders);
        await repo.upsertActivities(activities);
        // await repo.upsertUserSubmissions(assignmentSubmissions.flat());
      } catch (e) {
        console.dir(e, { depth: null });
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to insert module content" });
      }
    },
  }),
};

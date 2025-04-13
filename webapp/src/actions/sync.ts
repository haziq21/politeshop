import { ActionError, defineAction } from "astro:actions";
import { dataResult, errorResult, unwrapResults } from "../../../shared";
import { logger } from "../logging";
import type { Module, SubmissionDropbox, UserSubmission } from "../db";
import { GoogleGenerativeAI, SchemaType, type GenerationConfig } from "@google/generative-ai";
import { GEMINI_API_KEY } from "astro:env/server";
import type { Result } from "../../../shared";

// TODO: Return changed data
export const syncData = defineAction({
  handler: async (_, context) => {
    const polite = context.locals.polite;
    const repo = context.locals.repo;

    // Fetch all the data in parallel
    const { data, error } = await unwrapResults([
      polite.fetchPartialUser(),
      polite.fetchOrganization(),
      polite.fetchModulesAndSemesters(),
    ]);
    if (error) {
      polite.abort();
      logger.error({ err: error.data }, error.msg);
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "POLITEMall API call failed" });
    }
    const [partialUser, organization, { modules, semesters }] = data;

    // Update the database with the fetched data
    await repo.upsertOrganization(organization);
    await repo.upsertUser({ ...partialUser, organizationId: organization.id });
    await repo.upsertSemesters(semesters);
    const uglyModules = await repo.upsertAndAssociateModules(modules);

    // Rename ugly modules with GenAI
    if (uglyModules.length > 0) {
      logger.info(`Renaming ${uglyModules.length} modules...`);
      const renamedModules = await renameModules(uglyModules);
      await repo.upsertAndAssociateModules(renamedModules);
    }

    // Fetch everything in parallel
    const { data: fetchResult, error: fetchError } = await unwrapResults([
      unwrapResults(modules.map((m) => polite.fetchModuleContent(m.id))),
      unwrapResults(modules.map((m) => polite.fetchQuizzes(m.id))),
      // TODO: Perhaps this could be neater...
      unwrapResults(
        modules.map(async (m): Promise<Result<[SubmissionDropbox[], UserSubmission[]]>> => {
          const { data: dropboxes, error } = await polite.fetchSubmissionDropboxes(m.id);
          if (error) return errorResult(error);

          const { data: userSubs, error: error2 } = await unwrapResults(
            dropboxes.map((d) =>
              polite.fetchUserSubmissions(m.id, d.id, {
                dropboxIsClosed: !!d.closesAt && d.closesAt < new Date(),
                organizationId: organization.id,
              })
            )
          );
          if (error2) return errorResult(error2);

          return dataResult([dropboxes, userSubs.flat()]);
        })
      ),
    ]);
    if (fetchError) {
      polite.abort();
      logger.error({ err: fetchError.data }, fetchError.msg);
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "POLITEMall API call failed" });
    }
    const [moduleContents, quizzes, subs] = fetchResult;

    // Upsert the module content into the database
    try {
      await repo.upsertQuizzes(quizzes.flat());
      await repo.upsertSubmissionDropboxes(subs.flatMap(([dropboxes, _]) => dropboxes));
      await repo.upsertUserSubmissions(subs.flatMap(([_, subs]) => subs));
      await repo.upsertActivityFolders(moduleContents.flatMap((m) => m.activityFolders));
      await repo.upsertActivities(moduleContents.flatMap((m) => m.activities));
    } catch (e) {
      logger.error(e, "Failed to upsert data");
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to insert module content" });
    }
  },
});

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

import { logger } from "$lib/utils";
import type {
  Module,
  SubmissionDropbox,
  UserSubmission,
  ActivityFolder as DBActivityFolder,
  AnyActivity as DBAnyActivity,
} from "$lib/server/db";
import { OPENROUTER_API_KEY } from "$env/static/private";
import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";
import { getRequestEvent, query } from "$app/server";
import * as queries from "$lib/server/db/queries";
import type { ActivityFolder, AnyActivity } from "@politeshop/lib";

export const initUser = query(async () => {
  const { pl, sessionHash } = getRequestEvent().locals;

  // Fetch all the data in parallel
  const [partialUser, institution, { modules, semesters }] = await Promise.all([
    pl.getUser(),
    pl.getInstitution(),
    pl.getModulesAndSemesters(),
  ]);

  // Update the database with the fetched data
  await queries.upsertOrganization({
    id: institution.id,
    name: institution.name,
  });
  await queries.upsertUser({
    id: partialUser.id,
    name: partialUser.name,
    sessionHash,
    organizationId: institution.id,
  });
  await queries.upsertSemesters(semesters);
  const uglyModules = await queries.upsertAndAssociateModules(
    partialUser.id,
    modules,
  );

  // Rename ugly modules with GenAI
  if (uglyModules.length > 0) {
    logger.info(`Renaming ${uglyModules.length} modules...`);
    const renamedModules = await renameModules(uglyModules);
    await queries.upsertAndAssociateModules(partialUser.id, renamedModules);
  }

  // Fetch everything in parallel
  const [moduleContents, quizzes, [dropboxes, userSubs]] = await Promise.all([
    Promise.all(modules.map((m) => pl.getModuleContent({ moduleId: m.id }))),
    Promise.all(modules.map((m) => pl.getQuizzes({ moduleId: m.id }))),
    Promise.all(
      modules.map(
        async (m): Promise<[SubmissionDropbox[], UserSubmission[]]> => {
          const dropboxes = await pl.getSubmissionDropboxes({ moduleId: m.id });

          const userSubs = await Promise.all(
            dropboxes.map((d) =>
              pl
                .getSubmissions({
                  moduleId: m.id,
                  dropboxId: d.id,
                  organizationId: institution.id,
                })
                .then((subs) =>
                  subs.map((s) => ({ ...s, userId: partialUser.id })),
                ),
            ),
          );

          return [dropboxes, userSubs.flat()];
        },
      ),
    ).then(
      (res) =>
        [res.flatMap(([d, _]) => d), res.flatMap(([_, s]) => s)] as const,
    ),
  ]);

  // Flatten the recursive ActivityFolder[] structures from each module into DB-ready records
  const allFolders: DBActivityFolder[] = [];
  const allActivities: DBAnyActivity[] = [];

  moduleContents.forEach((folders, i) => {
    const { folders: flat, activities } = flattenActivityFolders(
      folders,
      modules[i]!.id,
      null,
    );
    allFolders.push(...flat);
    allActivities.push(...activities);
  });

  // Upsert the module content into the database
  await queries.upsertQuizzes(quizzes.flat());
  await queries.upsertSubmissionDropboxes(dropboxes);
  await queries.upsertUserSubmissions(userSubs);
  await queries.upsertActivityFolders(allFolders);
  await queries.upsertActivities(allActivities);
});

/**
 * Recursively flatten a tree of {@link ActivityFolder}s (as returned by
 * `POLITEShop.getModuleContent`) into the flat arrays that the DB expects.
 */
function flattenActivityFolders(
  folders: ActivityFolder[],
  moduleId: string,
  parentId: string | null,
  result: { folders: DBActivityFolder[]; activities: DBAnyActivity[] } = {
    folders: [],
    activities: [],
  },
): { folders: DBActivityFolder[]; activities: DBAnyActivity[] } {
  for (const folder of folders) {
    result.folders.push({
      id: folder.id,
      name: folder.name,
      description: folder.description,
      parentId,
      moduleId,
      sortOrder: folder.sortOrder,
    });

    for (const item of folder.contents) {
      if (item.type === "folder") {
        flattenActivityFolders([item], moduleId, folder.id, result);
      } else {
        // Cast is safe: library's AnyActivity fields are a structural subset of
        // DB's AnyActivity fields; we just add the required folderId.
        result.activities.push({
          ...(item as AnyActivity),
          folderId: folder.id,
        } as DBAnyActivity);
      }
    }
  }

  return result;
}

async function renameModules(modules: Module[]): Promise<Module[]> {
  logger.info(moduleRenamePrompt(modules));

  const client = new OpenRouter({ apiKey: OPENROUTER_API_KEY });

  const result = await client.chat.send({
    chatGenerationParams: {
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: moduleRenamePrompt(modules) }],
      temperature: 0,
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "module_renames",
          strict: true,
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    niceCode: { type: "string" },
                    niceName: { type: "string" },
                  },
                  required: ["niceCode", "niceName"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
    },
  });

  const rawContent = result.choices[0].message.content;
  if (!rawContent) {
    throw new Error("OpenRouter returned an empty response");
  }
  if (typeof rawContent !== "string") {
    throw new Error("OpenRouter returned unexpected non-text content");
  }
  const content = rawContent;

  const schema = z.object({
    items: z.array(
      z.object({
        niceCode: z.string(),
        niceName: z.string(),
      }),
    ),
  });

  const { items } = schema.parse(JSON.parse(content));

  return modules.map((module, i) => ({
    ...module,
    niceCode: items[i].niceCode,
    niceName: items[i].niceName,
  }));
}

const moduleRenamePrompt = (
  modules: Module[],
) => `Each JSON object in the array below describes the name and code of a module offered by a Polytechnic in Singapore. Output a corresponding array of JSON objects with each object containing the string fields "niceName" and "niceCode".

Output a JSON object with an "items" array containing one entry per module, in the same order as the input.

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

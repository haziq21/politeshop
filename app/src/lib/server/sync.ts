import type { POLITELib } from "@politeshop/lib";

import { OPENROUTER_API_KEY } from "$app/env/private";
import { OpenRouterProvider, renameModules } from "@politeshop/ai";

import type { Module } from "#lib/server/db/index.ts";

import * as queries from "#lib/server/db/queries.ts";
import { logger } from "#lib/utils.ts";

// Each function fetches and stores only what its name says, and assumes the rows its arguments refer
// to are already in the database.

export async function syncOrganization(pl: POLITELib) {
  const institution = await pl.getInstitution();
  await queries.upsertOrganization({ id: institution.id, name: institution.name });
  return institution;
}

export async function syncUser(
  pl: POLITELib,
  { sessionHash, organizationId }: { sessionHash: number; organizationId: string },
) {
  const user = await pl.getUser();
  await queries.upsertUser({ id: user.id, name: user.name, sessionHash, organizationId });
  return user;
}

/** Returns the modules whose names are missing or outdated. */
export async function syncModulesAndSemesters(pl: POLITELib, { userId }: { userId: string }) {
  const { modules, semesters } = await pl.getModulesAndSemesters();
  await queries.upsertSemesters(semesters);
  return queries.upsertAndAssociateModules(
    userId,
    modules.map((m) => ({
      ...m,
      imageIconURL: pl.getInstitutionImageURL({ institutionId: m.id, width: 60, height: 60 }),
    })),
  );
}

export async function syncModuleNames(modules: Module[], { userId }: { userId: string }) {
  if (modules.length === 0) return;

  logger.info(`Renaming ${modules.length} modules...`);
  const provider = new OpenRouterProvider({
    apiKey: OPENROUTER_API_KEY,
    model: "openai/gpt-5.4-mini",
    reasoning: { effort: "low" },
  });
  const names = await renameModules(
    provider,
    modules.map((m) => ({ name: m.name, code: m.code })),
  );
  await queries.upsertAndAssociateModules(
    userId,
    modules.map((m, i) => ({ ...m, niceCode: names[i]!.niceCode, niceName: names[i]!.niceName })),
  );
}

export async function syncQuizzes(pl: POLITELib, { moduleId }: { moduleId: string }) {
  await queries.upsertQuizzes(await pl.getQuizzes({ moduleId }));
}

export async function syncSubmissionDropboxes(pl: POLITELib, { moduleId }: { moduleId: string }) {
  const dropboxes = await pl.getSubmissionDropboxes({ moduleId });
  await queries.upsertSubmissionDropboxes(dropboxes);
  return dropboxes;
}

export async function syncUserSubmissions(
  pl: POLITELib,
  {
    userId,
    organizationId,
    moduleId,
    dropboxId,
  }: { userId: string; organizationId: string; moduleId: string; dropboxId: string },
) {
  const submissions = await pl.getSubmissions({ moduleId, dropboxId, organizationId });
  await queries.upsertUserSubmissions(submissions.map((s) => ({ ...s, userId })));
}

/**
 * Activities reference their dropbox or quiz. Unless `stubReferencedAssessments` is set, those must
 * already be stored; if it is, any that aren't are stored with just their name, to be filled in by
 * `syncAssessments`.
 */
export async function syncModuleActivities(
  pl: POLITELib,
  {
    userId,
    moduleId,
    stubReferencedAssessments = false,
  }: { userId: string; moduleId: string; stubReferencedAssessments?: boolean },
) {
  const activities = (await pl.getModuleActivities({ moduleId })).map((a) => ({ ...a, moduleId }));

  await Promise.all([
    stubReferencedAssessments &&
      queries.insertMissingSubmissionDropboxes(
        activities.flatMap((a) => (a.type === "submission" ? [{ id: a.dropboxId, moduleId, name: a.name }] : [])),
      ),
    stubReferencedAssessments &&
      queries.insertMissingQuizzes(
        activities.flatMap((a) => (a.type === "quiz" ? [{ id: a.quizId, moduleId, name: a.name }] : [])),
      ),
  ]);
  await queries.upsertActivities(activities);
  await queries.setUserActivityAccess(
    userId,
    moduleId,
    activities.map((a) => a.id),
  );
}

/** A module's quizzes, submission dropboxes and the user's submissions. */
export function syncAssessments(
  pl: POLITELib,
  { userId, organizationId, moduleId }: { userId: string; organizationId: string; moduleId: string },
) {
  return Promise.all([
    syncQuizzes(pl, { moduleId }),
    syncSubmissionDropboxes(pl, { moduleId }).then((dropboxes) =>
      Promise.all(dropboxes.map((d) => syncUserSubmissions(pl, { userId, organizationId, moduleId, dropboxId: d.id }))),
    ),
  ]);
}

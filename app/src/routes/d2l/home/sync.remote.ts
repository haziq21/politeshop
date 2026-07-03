import { getRequestEvent, query } from "$app/server";
import { OPENROUTER_API_KEY } from "$env/static/private";
import * as queries from "$lib/server/db/queries";
import { logger } from "$lib/utils";
import { OpenRouterProvider, renameModules } from "@politeshop/ai";

export const sync = query(async () => {
  const { pl, sessionHash } = getRequestEvent().locals;

  const user = await queries.getUserFromSessionHash(sessionHash);
  const userId = user!.id;

  const [partialUser, institution, { modules: partialModules, semesters }] = await Promise.all([
    pl.getUser(),
    pl.getInstitution(),
    pl.getModulesAndSemesters(),
  ]);

  const modules = partialModules.map((m) => ({
    ...m,
    imageIconURL: pl.getInstitutionImageURL({
      institutionId: m.id,
      width: 60,
      height: 60,
    }),
  }));

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
  const uglyModules = await queries.upsertAndAssociateModules(partialUser.id, modules);

  if (uglyModules.length > 0) {
    logger.info(`Renaming ${uglyModules.length} modules...`);
    const provider = new OpenRouterProvider({
      apiKey: OPENROUTER_API_KEY,
      model: "openai/gpt-5.4-mini",
      reasoning: { effort: "low" },
    });
    const renamedPairs = await renameModules(
      provider,
      uglyModules.map((m) => ({ name: m.name, code: m.code })),
    );
    await queries.upsertAndAssociateModules(
      partialUser.id,
      uglyModules.map((module, i) => ({
        ...module,
        niceCode: renamedPairs[i]!.niceCode,
        niceName: renamedPairs[i]!.niceName,
      })),
    );
  }

  const [organization, freshSemesters, freshModules] = await Promise.all([
    queries.getOrganization(userId),
    queries.getSemesters(userId),
    queries.getModules(userId),
  ]);

  return {
    organization,
    semesters: freshSemesters.sort((a, b) => b.name.localeCompare(a.name)),
    modules: freshModules,
  };
});

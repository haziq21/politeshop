import { getRequestEvent, query } from "$app/server";
import * as queries from "$lib/server/db/queries";

export const initUser = query(async () => {
  const { pl, sessionHash } = getRequestEvent().locals;

  const [partialUser, institution] = await Promise.all([
    pl.getUser(),
    pl.getInstitution(),
  ]);

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
});

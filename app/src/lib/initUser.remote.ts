import { getRequestEvent, query } from "$app/server";
import { syncOrganization, syncUser } from "$lib/server/sync";

export const initUser = query(async () => {
  const { pl, sessionHash } = getRequestEvent().locals;

  const organization = await syncOrganization(pl);
  await syncUser(pl, { sessionHash, organizationId: organization.id });
});

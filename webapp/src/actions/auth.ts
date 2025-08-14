import { ActionError, defineAction } from "astro:actions";
import { SIGNING_KEY } from "astro:env/server";
import { z } from "astro:schema";
import * as jose from "jose";
import { POLITEMallClient } from "../politemall";
import { Repository } from "../repository";
import { getD2lSessionSignature } from "../../../shared";

/**
 * Updates a user's source credentials in the database.
 * If the user doesn't exist, it creates a new user.
 */
export const registerSourceCredentials = defineAction({
  input: z.object({
    d2lSessionVal: z.string(),
    d2lSecureSessionVal: z.string(),
    d2lFetchToken: z.string(),
    domain: z.string(),
  }),
  handler: async ({ d2lSessionVal, d2lSecureSessionVal, d2lFetchToken, domain }) => {
    const polite = new POLITEMallClient({ d2lSessionVal, d2lSecureSessionVal, domain, d2lFetchToken });

    const organizationPromise = polite.fetchOrganization();
    const { data: partialUser, error: partialUserError } = await polite.fetchPartialUser();
    if (partialUserError)
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "POLITEMall API call failed" });

    const d2lSessionSignature = await getD2lSessionSignature({ d2lSessionVal, d2lSecureSessionVal });
    const repo = new Repository(partialUser.id);

    // If this user already exists in POLITEShop's database, we just need to update the session tokens
    if (!(await repo.updateUser({ d2lSessionVal, d2lSecureSessionVal, d2lFetchToken }))) {
      // TODO: If the org is in the database, we could retrieve it based on the domain instead
      const { data: organization, error: organizationError } = await organizationPromise;
      if (organizationError)
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "POLITEMall API call failed" });

      await repo.upsertUser({
        ...partialUser,
        organizationId: organization.id,
        d2lSessionVal,
        d2lSecureSessionVal,
        d2lFetchToken,
        d2lSessionSignature,
      });
    }
  },
});

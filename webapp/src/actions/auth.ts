import { ActionError, defineAction } from "astro:actions";
import { SIGNING_KEY } from "astro:env/server";
import * as jose from "jose";

export const getPOLITEShopJWT = defineAction({
  handler: async (_, context) => {
    const polite = context.locals.polite;

    console.log("setPOLITEShopJWT(): Fetching partial user data...");
    const { data: partialUserData, error } = await polite.fetchPartialUser();
    if (error)
      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch user from POLITEMall" });
    console.log(`setPOLITEShopJWT(): Fetched partial user data: ${JSON.stringify(partialUserData)}`);

    // Produce the politeshopJWT and set it as a cookie
    const jwtSigningKey = new TextEncoder().encode(SIGNING_KEY);
    return await new jose.SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(partialUserData.id)
      .sign(jwtSigningKey);
  },
});

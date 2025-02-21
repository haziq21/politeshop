import { BRIGHTSPACE_JWT, D2L_SECURE_SESSION_VAL, D2L_SESSION_VAL, POLITE_DOMAIN, SIGNING_KEY } from "astro:env/server";
import { defineMiddleware } from "astro:middleware";
import { POLITEMallClient } from "./politemall";
import * as jose from "jose";
import { Datastore } from "./datastore";

export const onRequest = defineMiddleware(async (context, next) => {
  // If the request doesn't contain POLITEMall auth cookies, fallback to env vars (for testing in development)
  const d2lSessionVal = context.cookies.get("d2lSessionVal")?.value || D2L_SESSION_VAL;
  const d2lSecureSessionVal = context.cookies.get("d2lSecureSessionVal")?.value || D2L_SECURE_SESSION_VAL;
  const brightspaceJWT = context.cookies.get("brightspaceJWT")?.value || BRIGHTSPACE_JWT;
  const domain = context.cookies.get("domain")?.value || POLITE_DOMAIN;

  // All requests must have these cookies set
  if (!d2lSessionVal || !d2lSecureSessionVal || !brightspaceJWT || !domain)
    return new Response("Unauthorized", { status: 401 });

  const polite = new POLITEMallClient({ d2lSessionVal, d2lSecureSessionVal, brightspaceJWT, domain });
  context.locals.polite = polite;

  const jwtSigningKey = new TextEncoder().encode(SIGNING_KEY);
  const politeshopJWT = context.cookies.get("politeshopJWT")?.value;
  // We don't trust the user ID from the brightspaceJWT because
  // it could have been tampered with (and we can't verify it)
  let trustedUserId: string;

  if (politeshopJWT) {
    // Get the user ID from the politeshopJWT. This is a trusted source
    // of the user ID, so we update the POLITEMallClient to use it.
    const { payload } = await jose.jwtVerify(politeshopJWT, jwtSigningKey);
    if (!payload.sub) return new Response("Invalid politeshopJWT", { status: 401 });
    trustedUserId = payload.sub;
  } else {
    // Get the user ID from a trusted source
    const { data: partialUserData, error } = await polite.fetchPartialUser();
    if (error) return new Response("POLITEShop had problems talking to POLITEMall...", { status: 500 });
    trustedUserId = partialUserData.id;

    // Produce the politeshopJWT and set it as a cookie
    context.cookies.set(
      "politeshopJWT",
      await new jose.SignJWT().setProtectedHeader({ alg: "HS256" }).setSubject(trustedUserId).sign(jwtSigningKey),
      { sameSite: "none", secure: true }
    );
  }

  polite.userId = trustedUserId;
  context.locals.datastore = new Datastore(trustedUserId);

  // Redirect the user to register them with POLITEShop if they don't exist in our database
  if (context.originPathname !== "/register" && !context.locals.datastore.userExists())
    return context.redirect("/register");

  return next();
});

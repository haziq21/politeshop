import { BRIGHTSPACE_JWT, D2L_SECURE_SESSION_VAL, D2L_SESSION_VAL, POLITE_DOMAIN, SIGNING_KEY } from "astro:env/server";
import { defineMiddleware } from "astro:middleware";
import { POLITEMallClient } from "./politemall";
import * as jose from "jose";
import { POLITEDataStore } from "./politeDataStore";

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

  const jwtSigningKey = new TextEncoder().encode(SIGNING_KEY);
  let politeshopJWT = context.cookies.get("politeshopJWT")?.value;
  // We don't trust the user ID from the brightspaceJWT because
  // it could have been tampered with (and we can't verify it)
  let trustedUserId: string;

  if (!politeshopJWT) {
    // Get the user ID from a trusted source
    const { data: partialUserData, error: partialUserError } = await polite.fetchPartialUser();
    if (partialUserError) return new Response("Failed to fetch user data", { status: 500 });
    trustedUserId = partialUserData.id;

    const politeDataStore = new POLITEDataStore(trustedUserId);
    context.locals.politeDataStore = politeDataStore;

    const { data: schoolData, error: schoolError } = await polite.fetchSchool();
    if (schoolError) return new Response("Failed to fetch school data", { status: 500 });
    const fullUserData = { ...partialUserData, schoolId: schoolData.id };

    // Update the database with the user and school data if necessary
    await politeDataStore.insertAndAssociateSchool(schoolData);
    const userAlreadyRegistered = await politeDataStore.insertUser(fullUserData);

    // Produce the politeshopJWT
    politeshopJWT = await new jose.SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(trustedUserId)
      .sign(jwtSigningKey);

    // Set the politeshopJWT cookie so that future requests can use it
    context.cookies.set("politeshopJWT", politeshopJWT, { sameSite: "none", secure: true });

    if (!userAlreadyRegistered) {
      // Fetch all the user's data and insert it into the database
      const { data: semestersData, error: semestersError } = await polite.fetchSemesters();
      if (semestersError) return new Response("Failed to fetch semesters data", { status: 500 });
      await politeDataStore.insertSemesters(semestersData);

      const { data: modulesData, error: modulesError } = await polite.fetchModules();
      if (modulesError) return new Response("Failed to fetch modules data", { status: 500 });
      await politeDataStore.insertAndAssociateModules(modulesData);
    }
  } else {
    // Get the user ID from the politeshopJWT. This is a trusted source
    // of the user ID, so we update the POLITEMallClient to use it.
    const { payload } = await jose.jwtVerify(politeshopJWT, jwtSigningKey);
    if (!payload.sub) return new Response("Invalid JWT", { status: 401 });
    trustedUserId = payload.sub;
    context.locals.politeDataStore = new POLITEDataStore(trustedUserId);
  }

  polite.userId = trustedUserId;
  context.locals.polite = polite;
  return next();
});

import { BRIGHTSPACE_JWT, D2L_SECURE_SESSION_VAL, D2L_SESSION_VAL, POLITE_DOMAIN } from "astro:env/server";
import { defineMiddleware } from "astro:middleware";
import { POLITEMallClient } from "./politemall";

export const onRequest = defineMiddleware((context, next) => {
  // If the request doesn't contain POLITEMall auth cookies, fallback to env vars (for testing in development)
  const d2lSessionVal = context.cookies.get("d2lSessionVal")?.value || D2L_SESSION_VAL;
  const d2lSecureSessionVal = context.cookies.get("d2lSecureSessionVal")?.value || D2L_SECURE_SESSION_VAL;
  const brightspaceJWT = context.cookies.get("brightspaceJWT")?.value || BRIGHTSPACE_JWT;
  const domain = context.cookies.get("domain")?.value || POLITE_DOMAIN;

  // All requests must have these cookies set
  if (!d2lSessionVal || !d2lSecureSessionVal || !brightspaceJWT || !domain)
    return new Response("Unauthorized", { status: 401 });

  context.locals.polite = new POLITEMallClient({ d2lSessionVal, d2lSecureSessionVal, brightspaceJWT, domain });

  return next();
});

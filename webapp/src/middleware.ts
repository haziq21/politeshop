import { SIGNING_KEY } from "astro:env/server";
import { defineMiddleware } from "astro:middleware";
import { POLITEMallClient } from "./politemall";
import * as jose from "jose";
import { Repository } from "./repository";

export const onRequest = defineMiddleware(async (context, next) => {
  if (/^\/_astro\/registerSourceCredentials\/?$/.test(context.url.pathname)) return next();

  const d2lSessionSignature = context.cookies.get("d2lSessionSignature")?.value;
  if (!d2lSessionSignature) return new Response("Missing d2lSessionSignature", { status: 401 });

  // TODO: Query db for the user based on the signature

  const polite = new POLITEMallClient({ d2lSessionVal, d2lSecureSessionVal, d2lFetchToken: brightspaceJWT, domain });
  context.locals.polite = polite;
  context.locals.repo = new Repository(trustedUserId);

  return next();
});

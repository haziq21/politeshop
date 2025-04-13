import { SIGNING_KEY } from "astro:env/server";
import { defineMiddleware } from "astro:middleware";
import { POLITEMallClient } from "./politemall";
import * as jose from "jose";
import { Repository } from "./repository";

export const onRequest = defineMiddleware(async (context, next) => {
  const d2lSessionVal = context.cookies.get("d2lSessionVal")?.value;
  const d2lSecureSessionVal = context.cookies.get("d2lSecureSessionVal")?.value;
  const brightspaceJWT = context.cookies.get("brightspaceJWT")?.value;
  const domain = context.cookies.get("domain")?.value;
  const politeshopJWT = context.cookies.get("politeshopJWT")?.value;

  // All requests must have these cookies set
  if (!d2lSessionVal || !d2lSecureSessionVal || !brightspaceJWT || !domain)
    return new Response("Missing required cookies", { status: 401 });

  const polite = new POLITEMallClient({ d2lSessionVal, d2lSecureSessionVal, brightspaceJWT, domain });
  context.locals.polite = polite;

  if (!politeshopJWT) {
    // These paths don't require a politeshopJWT
    const path = new URL(context.request.url).pathname.replace(/\/$/, "");
    if (path === "/register" || path === "/_actions/getPOLITEShopJWT") return next();

    console.log(`Redirecting ${context.request.url} to /shop/register`);
    return context.redirect("/shop/register");
  }

  // Get the user ID from the politeshopJWT.
  // This is a trusted source of the user ID.
  const jwtSigningKey = new TextEncoder().encode(SIGNING_KEY);
  const { payload } = await jose.jwtVerify(politeshopJWT, jwtSigningKey);
  if (!payload.sub) return new Response("Invalid politeshopJWT", { status: 401 });
  const trustedUserId = payload.sub;

  polite.userId = trustedUserId;
  context.locals.repo = new Repository(trustedUserId);

  return next();
});

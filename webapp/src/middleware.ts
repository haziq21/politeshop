import { defineMiddleware } from "astro:middleware";
import { POLITEMallClient } from "./politemall";
import { Repository } from "./repository";
import { CREDENTIAL_HEADER_MAPPINGS, type CredentialName } from "../../shared";
import { initUser } from "./actions/setup";
import type { User } from "./db";

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname === "/d2l/login") return next();

  // Extract credentials from headers
  const credentials: Partial<Record<CredentialName, string>> = {};
  for (const [name, header] of Object.entries(CREDENTIAL_HEADER_MAPPINGS)) {
    const value = context.request.headers.get(header);
    if (value === null) return new Response(`Missing credentials: ${header} header`, { status: 401 });
    credentials[name as CredentialName] = value;
  }

  const fullCredentials = credentials as Record<CredentialName, string>;
  context.locals.polite = new POLITEMallClient(fullCredentials);

  context.locals.sessionHash = Repository.getSessionHash(fullCredentials);
  const user = await Repository.getUserFromSessionHash(context.locals.sessionHash);

  if (user) {
    context.locals.repo = new Repository(user.id);
    return next();
  }

  // Call the POLITEMall API to get this user's ID
  let partialUser: Pick<User, "id" | "name">;

  try {
    // If this fails, the session is probably expired
    partialUser = await context.locals.polite.fetchPartialUser();
  } catch {
    const { pathname, search, hash } = context.url;
    return next(`/d2l/login?sessionExpired=1&target=${encodeURIComponent(pathname + search + hash)}`);
  }
  context.locals.repo = new Repository(partialUser.id);

  if (await context.locals.repo.userExists()) {
    context.locals.repo.updateUser({ sessionHash: context.locals.sessionHash });
    return next();
  }

  const { error } = await context.callAction(initUser, null);
  if (error) throw new Error(`Failed to initialize user: ${error.message}`);

  return next();
});

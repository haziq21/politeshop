import { redirect, type Handle } from "@sveltejs/kit";
import {
  CREDENTIAL_HEADER_MAPPINGS,
  type CredentialName,
} from "@politeshop/shared";
import { POLITELib } from "@politeshop/lib";
import * as queries from "$lib/server/db/queries";
import type { User } from "$lib/server/db";
import { initUser } from "$lib/initUser.remote";

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname === "/d2l/login") return await resolve(event);

  // Extract credentials from headers
  const credentials: Partial<Record<CredentialName, string>> = {};
  for (const [name, header] of Object.entries(CREDENTIAL_HEADER_MAPPINGS)) {
    const value = event.request.headers.get(header);
    if (value === null)
      return new Response(`Missing credentials: ${header} header`, {
        status: 401,
      });
    credentials[name as CredentialName] = value;
  }

  const fullCredentials = credentials as Record<CredentialName, string>;
  event.locals.pl = new POLITELib({
    ...fullCredentials,
    domain: new URL(event.request.url).hostname.split(".")[0],
  });

  event.locals.sessionHash = await queries.getSessionHash(fullCredentials);
  const user = await queries.getUserFromSessionHash(event.locals.sessionHash);

  if (user) {
    return await resolve(event);
  }

  // Call the POLITEMall API to get this user's ID
  let partialUser: Pick<User, "id" | "name">;

  try {
    // If this fails, the session is probably expired
    partialUser = await event.locals.pl.getUser();
  } catch (error) {
    console.log(`failed to fetch partial user: ${error}`);
    const { pathname, search, hash } = event.url;
    const loginURL = `/d2l/login?sessionExpired=1&target=${encodeURIComponent(pathname + search + hash)}`;
    redirect(302, loginURL);
  }

  if (await queries.userExists(partialUser.id)) {
    await queries.updateUser({
      id: partialUser.id,
      sessionHash: event.locals.sessionHash,
    });
    return await resolve(event);
  }

  await initUser();
  return await resolve(event);
};

import { redirect, type Handle } from "@sveltejs/kit";
import { AUTH_HEADER_NAMES } from "@politeshop/shared";
import { POLITELib } from "@politeshop/lib";
import * as queries from "$lib/server/db/queries";
import type { User } from "$lib/server/db";
import { initUser } from "$lib/initUser.remote";

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname === "/d2l/login") return await resolve(event);

  const credentials = getCredentialsFromHeaders(event.request.headers);
  if (!credentials)
    return new Response(
      "Missing credentials: X-D2l-Session-Val and X-D2l-Secure-Session-Val are required",
      { status: 401 },
    );

  event.locals.pl = new POLITELib({
    ...credentials,
    domain: new URL(event.request.url).hostname.split(".")[0],
  });

  event.locals.sessionHash = await queries.getSessionHash(credentials);
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

function getCredentialsFromHeaders(headers: Headers): {
  d2lSessionVal: string;
  d2lSecureSessionVal: string;
  d2lFetchToken?: string;
} | null {
  const d2lSessionVal = headers.get(AUTH_HEADER_NAMES.d2lSessionVal);
  const d2lSecureSessionVal = headers.get(
    AUTH_HEADER_NAMES.d2lSecureSessionVal,
  );
  const d2lFetchToken =
    headers.get(AUTH_HEADER_NAMES.d2lFetchToken) ?? undefined;

  if (!d2lSessionVal || !d2lSecureSessionVal) return null;

  return {
    d2lSessionVal,
    d2lSecureSessionVal,
    d2lFetchToken,
  };
}

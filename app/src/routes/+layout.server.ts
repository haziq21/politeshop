import { COOKIE_NAME, parsePrefsCookie } from "$lib/preferences";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  // POLITEShop exposes polite.baseURL (e.g. "https://nplms.polite.edu.sg").
  // Extract just the subdomain so the rest of the app can construct URLs the
  // same way it always has.
  const baseURL = locals.pl?.polite.baseURL;
  const subdomain = baseURL ? (new URL(baseURL).hostname.split(".")[0] ?? null) : null;

  return { subdomain, theme: parsePrefsCookie(cookies.get(COOKIE_NAME)).theme };
};

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  // POLITEShop exposes polite.baseURL (e.g. "https://nplms.polite.edu.sg").
  // Extract just the subdomain so the rest of the app can construct URLs the
  // same way it always has.
  const baseURL = locals.pl?.polite.baseURL;
  const subdomain = baseURL
    ? (new URL(baseURL).hostname.split(".")[0] ?? null)
    : null;

  return { subdomain };
};

import { funcs } from "../background";

/** Return `true` if the `politeshopJWT` matches `d2lSessionVal`
 * and `d2lSecureSessionVal`, and `false` otherwise.
 */
export async function verifyPOLITEShopJWTConsistency(
  politeshopJWT: string,
  {
    d2lSessionVal,
    d2lSecureSessionVal,
  }: {
    d2lSessionVal: string;
    d2lSecureSessionVal: string;
  }
): Promise<boolean> {
  const body = getJWTBody(politeshopJWT);
  if (!body || typeof body.d2lSessionHashSalt !== "string") return false;

  const expectedHash = await hashStringToBase64url(
    `${d2lSessionVal}:${d2lSecureSessionVal}:${body.d2lSessionHashSalt}`
  );

  return body.d2lSessionHash === expectedHash;
}

export function getBrightspaceToken(): string {
  // TODO: Better error handling
  return JSON.parse(localStorage.getItem("D2L.Fetch.Tokens")!)["*:*:*"].access_token;
}

/** Return the body of a JWT, or `null` if the JWT is invalid. */
export function getJWTBody(jwt: string): Record<string, unknown> | null {
  const payload = jwt.split(".").at(1);
  if (!payload) return null;
  // TODO: Better error handling
  const decodedPayload = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decodedPayload);
}

/** Return the SHA-256 hash of a string in base64url format. */
export async function hashStringToBase64url(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuff = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuff)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Send the user's d2lSessionVal and d2lSecureSessionVal to POLITEShop's database. */
export async function registerSourceCredentials(credentials: { d2lSessionVal: string; d2lSecureSessionVal: string }) {
  const url = `${process.env.POLITESHOP_URL!}/shop/register-source-credentials`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
}

/** Initialize the SSE connection to the live reload server, for use during development. */
export function initReloadClient() {
  const eventSource = new EventSource(process.env.LIVE_RELOAD_URL!);
  eventSource.addEventListener("open", funcs.reload);
  eventSource.addEventListener("change", async () => {
    await funcs.reload();
    window.location.reload();
  });
}

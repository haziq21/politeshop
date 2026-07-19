/**
 * Generate the user's session hash using their session credentials.
 */
export async function getSessionHash(credentials: {
  d2lSessionVal: string;
  d2lSecureSessionVal: string;
}): Promise<number> {
  const input = `${credentials.d2lSessionVal},${credentials.d2lSecureSessionVal}`;

  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return new DataView(hashBuffer).getInt32(0, false);
}

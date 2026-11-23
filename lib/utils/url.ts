/**
 * Return the last path component of a URL.
 * e.g. `lastPathComponent("https://host.com/foo/bar/123")` → `"123"`
 */
export function lastPathComponent(url: string | URL): string {
  if (typeof url === "string") url = new URL(url);
  return url.pathname.split("/").at(-1)!;
}

/**
 * Parse the expiry date from a time-limited resource URL.
 *
 * Handles:
 * - AWS S3 pre-signed URLs (`*.amazonaws.com`), which encode their expiry via
 *   `X-Amz-Date` + `X-Amz-Expires` query parameters.
 * - Brightspace Content Service URLs (`*.content-service.brightspace.com`),
 *   which encode their expiry as a Unix timestamp in the `Expires` query parameter.
 *
 * Returns `undefined` if the URL does not contain recognisable expiry information.
 */
export function getURLExpiry(url: string): Temporal.Instant | undefined {
  const urlObj = new URL(url);

  if (urlObj.hostname.endsWith(".amazonaws.com")) {
    const expiresIn = urlObj.searchParams.get("X-Amz-Expires");
    if (!expiresIn) return undefined;

    const startDate = urlObj.searchParams.get("X-Amz-Date");
    if (!startDate) return undefined;

    return Temporal.Instant.from(startDate).add({ seconds: +expiresIn });
  }

  if (urlObj.hostname.endsWith("content-service.brightspace.com")) {
    const expires = urlObj.searchParams.get("Expires");
    if (!expires) return undefined;
    return Temporal.Instant.fromEpochMilliseconds(+expires * 1000);
  }

  return undefined;
}

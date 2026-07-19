import type { BrowserContext } from "@playwright/test";

const POLITEMALL_HOST = "polite.edu.sg";

/**
 * Simulates a logged-in POLITEMall session for the extension's content
 * script to pick up, without touching the real polite.edu.sg. Two things
 * make this safe:
 *
 * 1. `context.route()` intercepts requests before Chromium resolves DNS, so
 *    `https://{subdomain}.polite.edu.sg/**` never actually hits the network
 *    — this works even though the subdomain doesn't exist.
 * 2. The session cookies are fake values only ever checked by
 *    `MockPOLITELib` (enabled via `MOCK_POLITELIB=1`, see
 *    `hooks.server.ts`), which never validates them against a real session.
 *
 * Returns the fake `d2lSessionVal`/`d2lSecureSessionVal` cookie values so
 * the caller can compute the resulting `sessionHash` for DB fixtures.
 */
export async function mockPoliteMall(
  context: BrowserContext,
  { subdomain }: { subdomain: string },
): Promise<{ origin: string; d2lSessionVal: string; d2lSecureSessionVal: string }> {
  const domain = `${subdomain}.${POLITEMALL_HOST}`;
  const origin = `https://${domain}`;
  const d2lSessionVal = `e2e-session-${subdomain}`;
  const d2lSecureSessionVal = `e2e-secure-session-${subdomain}`;

  await context.addCookies([
    { name: "d2lSessionVal", value: d2lSessionVal, domain, path: "/", secure: true },
    { name: "d2lSecureSessionVal", value: d2lSecureSessionVal, domain, path: "/", secure: true },
  ]);

  await context.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());

    // The extension's content script matches any `/d2l/*` path, including
    // POLITEShop's own `/d2l/login` (reached via hooks.server.ts's redirect
    // when POLITELib.getUser() throws). In production, POLITEMall's real
    // `/d2l/login` immediately 302s to an external SSO provider — a domain
    // the content script doesn't match — which is what actually lets the
    // user re-authenticate. Replicate that here (redirecting to a path
    // outside `/d2l/*`, forwarding the query string) so the mock doesn't
    // loop forever re-iframing its own login page.
    if (url.pathname === "/d2l/login") {
      return route.fulfill({ status: 302, headers: { location: `/sso/login${url.search}` } });
    }

    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><head><title>POLITEMall</title></head><body>Mock POLITEMall page for e2e tests.</body></html>",
    });
  });

  return { origin, d2lSessionVal, d2lSecureSessionVal };
}

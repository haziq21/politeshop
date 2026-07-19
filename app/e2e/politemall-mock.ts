import type { BrowserContext } from "@playwright/test";

import { SESSION_VALS } from "../src/lib/server/testing/mock-politelib";

export async function mockPoliteMall(
  context: BrowserContext,
  { subdomain, sessionExpired = false }: { subdomain: string; sessionExpired?: boolean },
): Promise<{ origin: string; d2lSessionVal: string; d2lSecureSessionVal: string }> {
  const domain = `${subdomain}.polite.edu.sg`;
  const origin = `https://${domain}`;
  const { d2lSessionVal, d2lSecureSessionVal } = sessionExpired ? SESSION_VALS.expired : SESSION_VALS.valid;

  await context.addCookies([
    { name: "d2lSessionVal", value: d2lSessionVal, domain, path: "/", secure: true },
    { name: "d2lSecureSessionVal", value: d2lSecureSessionVal, domain, path: "/", secure: true },
  ]);

  await context.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/d2l/login") {
      return route.fulfill({ status: 302, headers: { location: `/sso/login${url.search}` } });
    }

    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><head><title>POLITEMall</title></head><body>Mock POLITEMall page.</body></html>",
    });
  });

  return { origin, d2lSessionVal, d2lSecureSessionVal };
}

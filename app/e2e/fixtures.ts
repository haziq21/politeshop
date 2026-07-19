import type { Mw } from "mockwright";

import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";

import { mockwright } from "../src/lib/server/mockwright";
import { createMockData } from "./data";
import { resetData, seedData } from "./db";

const EXTENSION_PATH = path.resolve(import.meta.dirname, "../../ext/.output/chrome-mv3");

type Fixtures = {
  context: BrowserContext;
  mw: Mw<typeof mockwright>;
  subdomain: string;
  credentials: { d2lSessionVal: string; d2lSecureSessionVal: string };
  seededUser: ReturnType<typeof createMockData>;
};

export const test = base.extend<Fixtures>({
  mw: mockwright.fixture(),
  context: async ({ subdomain }, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      baseURL: `https://${subdomain}.polite.edu.sg`,
      args: [
        "--no-sandbox",
        "--disable-features=LocalNetworkAccessChecks",
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });

    await use(context);
    await context.close();
  },

  subdomain: async ({}, use, { testId }) => use(`t-${testId}`),

  // Session hashes are unique per user, so credentials must be too
  credentials: async ({}, use) => use({ d2lSessionVal: crypto.randomUUID(), d2lSecureSessionVal: crypto.randomUUID() }),

  page: async ({ context, page, subdomain, credentials }, use) => {
    const domain = `${subdomain}.polite.edu.sg`;

    await context.addCookies([
      { name: "d2lSessionVal", value: credentials.d2lSessionVal, domain, path: "/", secure: true },
      { name: "d2lSecureSessionVal", value: credentials.d2lSecureSessionVal, domain, path: "/", secure: true },
    ]);

    await context.route(`https://${domain}/**`, (route) => {
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

    await use(page);
  },

  seededUser: async ({ credentials }, use) => {
    const data = createMockData();

    try {
      await seedData(data, credentials);
      await use(data);
    } finally {
      await resetData(data);
    }
  },
});

export const expect = test.expect;

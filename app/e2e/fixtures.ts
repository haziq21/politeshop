/* oxlint-disable no-empty-pattern -- Playwright needs a destructured first argument, even for fixtures with no dependencies */
import type { Mw } from "mockwright";

import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";

import { mockwright } from "../src/lib/server/mockwright";
import { createMocks, resetData, seedData } from "./data";

const EXTENSION_PATH = path.resolve(import.meta.dirname, "../../ext/.output/chrome-mv3");

type Fixtures = {
  context: BrowserContext;
  mw: Mw<typeof mockwright>;
  subdomain: string;
  credentials: { d2lSessionVal: string; d2lSecureSessionVal: string };
  /** `data` is seeded into the DB for the test user; `pl` is what POLITEMall returns to match it */
  mocks: ReturnType<typeof createMocks>;
};

export const test = base.extend<Fixtures>({
  mw: mockwright.fixture(),
  context: async ({ subdomain }, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      timezoneId: "UTC",
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

  mocks: async ({ mw, credentials }, use) => {
    const mocks = createMocks();
    await mw("pl.getModuleActivities").mockResolvedValue(mocks.pl.activities);
    await mw("pl.getQuizzes").mockResolvedValue(mocks.pl.quizzes);
    await mw("pl.getSubmissionDropboxes").mockResolvedValue(mocks.pl.dropboxes);
    await mw("pl.getSubmissions").mockResolvedValue(mocks.pl.submissions);

    try {
      await seedData(mocks.data, credentials);
      await use(mocks);
    } finally {
      await resetData(mocks.data);
    }
  },
});

export const expect = test.expect;

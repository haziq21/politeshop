import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";

const EXTENSION_PATH = path.resolve(import.meta.dirname, "../../ext/.output/chrome-mv3");

export const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
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
});

export const expect = test.expect;

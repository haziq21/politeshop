import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";

const EXTENSION_PATH = path.resolve(import.meta.dirname, "../../ext/.output/chrome-mv3");

/**
 * Extends Playwright's `test` with a `context` fixture that loads the
 * POLITEShop extension unpacked, following Playwright's documented pattern
 * for testing Chrome extensions (persistent context + `--load-extension`).
 *
 * MV3 extensions only run their background service worker (and content
 * scripts, in turn) when the browser isn't the stripped-down "headless
 * shell" Playwright uses by default for `headless: true`. Chrome's "new"
 * headless mode (`--headless=new`) supports extensions, so we force it via
 * an explicit flag while asking Playwright for a headed launch (which picks
 * the full `chromium` binary rather than `chromium-headless-shell`).
 *
 * The `--disable-features=...Private/LocalNetworkAccess...` flags disable
 * Chrome's Local Network Access checks: without them, Chrome blocks the
 * POLITEShop iframe navigation because it's a "public" page (the mocked
 * `polite.edu.sg`, whose DNS doesn't resolve) fetching a "private" resource
 * (our `localhost` dev server) — a restriction that wouldn't apply in
 * production, where both origins are public.
 */
export const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        "--headless=new",
        "--no-sandbox",
        "--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWarn,PrivateNetworkAccessForNavigations,PrivateNetworkAccessForWorkers,PrivateNetworkAccessRespectPreflightResults,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests",
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });

    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent("serviceworker", { timeout: 15_000 });
    void worker;

    await use(context);
    await context.close();
  },
});

export const expect = test.expect;

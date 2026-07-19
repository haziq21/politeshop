import { deleteFixture, seedReturningUser } from "./db";
import { expect, test } from "./fixtures";
import { mockPoliteMall } from "./politemall-mock";

// Any subdomain works here, it just needs to be unique across spec files so
// parallel/adjacent runs never collide in the (real, shared) dev database.
const SUBDOMAIN = "e2e-returning";

test.describe("extension-mediated session: returning user", () => {
  test.afterEach(async () => {
    await deleteFixture(SUBDOMAIN);
  });

  test("extension replaces the POLITEMall page with the POLITEShop iframe, rendering synced data", async ({
    context,
  }) => {
    const { origin, d2lSessionVal, d2lSecureSessionVal } = await mockPoliteMall(context, { subdomain: SUBDOMAIN });
    // Pre-seed the DB as if this user (and this module) had synced before —
    // this exercises the `getUserFromSessionHash` fast path in
    // `hooks.server.ts`, and keeps the module's niceName/niceCode already
    // set so the client-side sync() call doesn't trigger the OpenRouter
    // module-renaming path in sync.remote.ts (out of scope for these tests).
    await seedReturningUser(SUBDOMAIN, { d2lSessionVal, d2lSecureSessionVal });

    const page = await context.newPage();
    await page.goto(`${origin}/d2l/home`);

    // The content script clears <head>/<body> and injects an iframe pointing
    // at the POLITEShop app — confirm we actually left the POLITEMall page.
    await expect(page.locator("iframe")).toHaveCount(1);

    const app = page.frameLocator("iframe");
    await expect(app.getByRole("heading", { name: "POLITEShop E2E Institute" })).toBeVisible();
    await expect(app.getByText("IT101")).toBeVisible();
    await expect(app.getByText("Introduction to Testing")).toBeVisible();
  });
});

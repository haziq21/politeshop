import { MOCK_EXPIRED_SESSION_SUBDOMAIN } from "../src/lib/server/testing/mock-politelib";
import { expect, test } from "./fixtures";
import { mockPoliteMall } from "./politemall-mock";

test("an expired POLITEMall session redirects the outer page back to /d2l/login", async ({ context }) => {
  const { origin } = await mockPoliteMall(context, { subdomain: MOCK_EXPIRED_SESSION_SUBDOMAIN });

  const page = await context.newPage();
  await page.goto(`${origin}/d2l/home`);

  // hooks.server.ts redirects to /d2l/login when POLITELib.getUser() throws
  // (simulated by MockPOLITELib for this subdomain). The login page then
  // posts a REDIRECT_LOGIN window message, which content.ts's listener turns
  // into a top-level navigation of the OUTER (real POLITEMall) page back to
  // `/d2l/login` — this is what actually gets a user back to POLITEMall's
  // login flow. The mock 302s that path to `/sso/login` (see
  // politemall-mock.ts) to mimic POLITEMall handing off to an external SSO
  // provider, forwarding the query string so we can confirm the `target`
  // (the page to return to after logging in) survived the round trip.
  await expect(page).toHaveURL(`${origin}/sso/login?sessionExpired=1&target=%2Fd2l%2Fhome`);
});

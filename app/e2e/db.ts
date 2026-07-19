import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../src/lib/server/db/schema";

/**
 * Standalone DB client for e2e test setup/teardown. This intentionally does
 * NOT import `$lib/server/db` (which pulls in `$env/static/private` — a
 * SvelteKit virtual module that only resolves inside the Vite/SvelteKit
 * pipeline). Playwright test files run as plain Node scripts, so they read
 * `DATABASE_URL` directly from `process.env` instead (loaded from `app/.env`
 * by `playwright.config.ts`).
 *
 * Tests run against the same database as `pnpm dev` (see AGENTS.md / MR
 * description for rationale). To keep this safe, every row created by e2e
 * tests uses IDs prefixed with `e2e-` so it can never collide with real
 * POLITEMall data, and `deleteFixture` below cleans them up.
 */
export const db = drizzle(process.env.DATABASE_URL!, { schema });

export { schema };

/** Namespaces every fixture ID under a given test subdomain, e.g. `e2e-returning-user`. */
export function fixtureIds(subdomain: string) {
  return {
    userId: `${subdomain}-user`,
    orgId: `${subdomain}-org`,
    semesterId: `${subdomain}-sem-1`,
    moduleId: `${subdomain}-module-1`,
  };
}

/**
 * Replicates `getSessionHash` from `$lib/server/db/queries.ts` so tests can
 * pre-compute the `sessionHash` a given pair of session cookies will hash to,
 * without importing SvelteKit server code.
 */
export async function sessionHash(credentials: {
  d2lSessionVal: string;
  d2lSecureSessionVal: string;
}): Promise<number> {
  const input = `${credentials.d2lSessionVal},${credentials.d2lSecureSessionVal}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return new DataView(hashBuffer).getInt32(0, false);
}

/**
 * Seed a "returning user" fixture: an organization, semester, module (with
 * `niceName`/`niceCode` already set, as if another student had already
 * synced it), and a user record whose `sessionHash` matches the given
 * credentials. This lets a test start from the `getUserFromSessionHash` fast
 * path in `hooks.server.ts`, and also means the client-side `sync()` call
 * won't see a brand new module (so it never triggers the OpenRouter module
 * renaming call in `sync.remote.ts` — that path needs a real OPENROUTER_API_KEY
 * and is out of scope for these e2e tests).
 */
export async function seedReturningUser(
  subdomain: string,
  credentials: { d2lSessionVal: string; d2lSecureSessionVal: string },
) {
  const ids = fixtureIds(subdomain);
  const hash = await sessionHash(credentials);

  await db.insert(schema.organization).values({ id: ids.orgId, name: "POLITEShop E2E Institute" });
  await db.insert(schema.semester).values({ id: ids.semesterId, name: "AY2025/2026 Semester 2" });
  await db.insert(schema.module).values({
    id: ids.moduleId,
    name: "Introduction to Testing",
    code: "IT101",
    niceName: "Introduction to Testing",
    niceCode: "IT101",
    semesterId: ids.semesterId,
  });
  await db.insert(schema.user).values({
    id: ids.userId,
    name: "Test Student",
    organizationId: ids.orgId,
    sessionHash: hash,
  });
  await db.insert(schema.userModule).values({ userId: ids.userId, moduleId: ids.moduleId });

  return ids;
}

/** Deletes every row created by {@link seedReturningUser} (and anything MockPOLITELib creates) for a subdomain. */
export async function deleteFixture(subdomain: string) {
  const ids = fixtureIds(subdomain);

  // user delete cascades to userModule / userSubmission / access tables
  await db.delete(schema.user).where(eq(schema.user.id, ids.userId));
  // module delete cascades to activityFolder / activity / submissionDropbox / quiz
  await db.delete(schema.module).where(eq(schema.module.id, ids.moduleId));
  await db.delete(schema.semester).where(eq(schema.semester.id, ids.semesterId));
  await db.delete(schema.organization).where(eq(schema.organization.id, ids.orgId));
}

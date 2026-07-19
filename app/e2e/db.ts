import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../src/lib/server/db/schema";
import { getSessionHash } from "../src/lib/server/session-hash";
import { mockDataFor } from "../src/lib/server/testing/mock-politelib";

export const db = drizzle(process.env.DATABASE_URL!, { schema });

export async function seedData(subdomain: string, credentials: { d2lSessionVal: string; d2lSecureSessionVal: string }) {
  const { user, institution, semester, module } = mockDataFor(subdomain);

  await db.insert(schema.organization).values(institution);
  await db.insert(schema.semester).values(semester);
  await db.insert(schema.module).values({ ...module, niceName: module.name, niceCode: module.code });
  await db
    .insert(schema.user)
    .values({ ...user, organizationId: institution.id, sessionHash: await getSessionHash(credentials) });
  await db.insert(schema.userModule).values({ userId: user.id, moduleId: module.id });
}

export async function resetData(subdomain: string) {
  const { user, institution, semester, module } = mockDataFor(subdomain);

  await db.delete(schema.user).where(eq(schema.user.id, user.id));
  await db.delete(schema.module).where(eq(schema.module.id, module.id));
  await db.delete(schema.semester).where(eq(schema.semester.id, semester.id));
  await db.delete(schema.organization).where(eq(schema.organization.id, institution.id));
}

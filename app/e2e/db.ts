import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import type { createMockData } from "./data";

import * as schema from "../src/lib/server/db/schema";
import { getSessionHash } from "../src/lib/server/session-hash";

export const db = drizzle(process.env.DATABASE_URL!, { schema });

export async function seedData(
  { user, institution, semester, module }: ReturnType<typeof createMockData>,
  credentials: { d2lSessionVal: string; d2lSecureSessionVal: string },
) {
  await db.insert(schema.organization).values(institution);
  await db.insert(schema.semester).values(semester);
  await db.insert(schema.module).values({ ...module, niceName: module.name, niceCode: module.code });
  await db
    .insert(schema.user)
    .values({ ...user, organizationId: institution.id, sessionHash: await getSessionHash(credentials) });
  await db.insert(schema.userModule).values({ userId: user.id, moduleId: module.id });
}

export async function resetData({ user, institution, semester, module }: ReturnType<typeof createMockData>) {
  await db.delete(schema.user).where(eq(schema.user.id, user.id));
  await db.delete(schema.module).where(eq(schema.module.id, module.id));
  await db.delete(schema.semester).where(eq(schema.semester.id, semester.id));
  await db.delete(schema.organization).where(eq(schema.organization.id, institution.id));
}

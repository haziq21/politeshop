import { eq, sql } from "drizzle-orm";
import { db, school, user, semester, module, userModule } from "./db";
import type { POLITEData } from "./types";

export class POLITEDataStore {
  data: POLITEData = {};

  constructor(public userId: string) {}

  async user(): Promise<typeof user.$inferInsert> {
    if (this.data.user) return this.data.user;
    return (this.data.user = (await db.select().from(user).where(eq(user.id, this.userId)))[0]);
  }

  /** Insert the user into the database, returning whether the user was already present. */
  async insertUser(u: typeof user.$inferInsert): Promise<boolean> {
    const { userAlreadyRegistered } = (
      await db
        .insert(user)
        .values(u)
        .onConflictDoUpdate({ target: user.id, set: { name: u.name, schoolId: u.schoolId } })
        .returning({ userAlreadyRegistered: sql<boolean>`(xmax != 0)` })
    )[0];
    this.data.user = u;
    return userAlreadyRegistered;
  }

  async school(): Promise<typeof school.$inferInsert> {
    if (this.data.school) return this.data.school;

    const { user: userData, school: schoolData } = (
      await db.select().from(user).innerJoin(school, eq(school.id, user.schoolId)).where(eq(user.id, this.userId))
    )[0];
    this.data.user = userData;
    return (this.data.school = schoolData);
  }

  async insertAndAssociateSchool(s: typeof school.$inferInsert) {
    await db
      .insert(school)
      .values(s)
      .onConflictDoUpdate({ target: school.id, set: { name: s.name } });
    await db.update(user).set({ schoolId: s.id }).where(eq(user.id, this.userId));
    this.data.school = s;
  }

  async semesters(): Promise<(typeof semester.$inferInsert)[]> {
    if (this.data.semesters) return this.data.semesters;

    this.data.semesters = await db
      .select({ id: semester.id, name: semester.name })
      .from(semester)
      .innerJoin(module, eq(module.semesterId, semester.id))
      .innerJoin(userModule, eq(userModule.moduleId, module.id))
      .where(eq(userModule.userId, this.userId))
      .groupBy(semester.id);

    return this.data.semesters;
  }

  async insertSemesters(s: (typeof semester.$inferInsert)[]) {
    await db
      .insert(semester)
      .values(s)
      .onConflictDoUpdate({ target: semester.id, set: { name: sql.raw(`excluded.${semester.name.name}`) } });

    this.data.semesters = s;
  }

  async modules(): Promise<(typeof module.$inferInsert)[]> {
    if (this.data.modules) return this.data.modules;

    return (this.data.modules = await db
      .select({ id: module.id, name: module.name, code: module.code, semesterId: module.semesterId })
      .from(module)
      .innerJoin(userModule, eq(userModule.moduleId, module.id))
      .where(eq(userModule.userId, this.userId)));
  }

  async insertAndAssociateModules(mods: (typeof module.$inferInsert)[]) {
    await db
      .insert(module)
      .values(mods)
      .onConflictDoUpdate({
        target: module.id,
        set: {
          name: sql.raw(`excluded.${module.name.name}`),
          code: sql.raw(`excluded.${module.code.name}`),
          semesterId: sql.raw(`excluded.${module.semesterId.name}`),
        },
      });
    await db
      .insert(userModule)
      .values(mods.map((m) => ({ userId: this.userId, moduleId: m.id })))
      .onConflictDoNothing();
    this.data.modules = mods;
  }
}

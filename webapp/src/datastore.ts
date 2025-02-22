import { eq, getTableColumns, sql } from "drizzle-orm";
import { db, school, user, semester, module, userModule, activityFolder, activity } from "./db";

/** An interface to the POLITEShop database with local caching. */
export class Datastore {
  data: {
    school?: typeof import("./db").school.$inferInsert;
    user?: typeof import("./db").user.$inferInsert;
    semesters?: typeof import("./db").semester.$inferInsert[];
    modules?: typeof import("./db").module.$inferInsert[];
    /** Map of module IDs to activity folders. */
    activityFolders?: Map<string, typeof import("./db").activityFolder.$inferInsert[]>;
    /** Map of module IDs to activities. */
    activities?: Map<string, typeof import("./db").activity.$inferInsert[]>;
  } = {};

  constructor(public userId: string) {}

  /** Get the current user. */
  async user(): Promise<typeof user.$inferInsert> {
    if (this.data.user) return this.data.user;
    return (this.data.user = (await db.select().from(user).where(eq(user.id, this.userId)))[0]);
  }

  /** Whether the user exists in the database. */
  async userExists(): Promise<boolean> {
    return (await db.select().from(user).where(eq(user.id, this.userId))).length > 0;
  }

  /**
   * Insert the user into the database, returning `true` if the user was actually
   * inserted and `false` if the user was already present in the database.
   */
  async insertUser(u: typeof user.$inferInsert): Promise<boolean> {
    const { userInserted } = (
      await db
        .insert(user)
        .values(u)
        .onConflictDoUpdate({ target: user.id, set: { name: u.name, schoolId: u.schoolId } })
        .returning({ userInserted: sql<boolean>`(xmax = 0)` })
    )[0];
    this.data.user = u;
    return userInserted;
  }

  /** Get the user's school. */
  async school(): Promise<typeof school.$inferInsert> {
    if (this.data.school) return this.data.school;

    return (this.data.school = (
      await db
        .select({ ...getTableColumns(school) })
        .from(user)
        .innerJoin(school, eq(school.id, user.schoolId))
        .where(eq(user.id, this.userId))
    )[0]);
  }

  /** Insert the school and set it to the user's school. */
  async insertAndAssociateSchool(s: typeof school.$inferInsert) {
    await db
      .insert(school)
      .values(s)
      .onConflictDoUpdate({ target: school.id, set: { name: s.name } });
    await db.update(user).set({ schoolId: s.id }).where(eq(user.id, this.userId));
    this.data.school = s;
  }

  /** Get semesters the user is in. */
  async semesters(): Promise<(typeof semester.$inferInsert)[]> {
    // We're assuming that if insertSemester() is called first,
    // the inserted semesters are the only semesters the user has.
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

  /** Insert semesters the user is in. */
  async insertSemesters(s: (typeof semester.$inferInsert)[]) {
    await db
      .insert(semester)
      .values(s)
      .onConflictDoUpdate({ target: semester.id, set: { name: sql.raw(`excluded.${semester.name.name}`) } });

    if (!this.data.semesters) this.data.semesters = [];
    this.data.semesters.push(...s);
  }

  /** Get every module the user has. */
  async modules(): Promise<(typeof module.$inferInsert)[]> {
    // We're assuming that if insertAndAssociateModules() is called
    // first, the inserted modules are the only modules the user has.
    if (this.data.modules) return this.data.modules;

    return (this.data.modules = await db
      .select({ id: module.id, name: module.name, code: module.code, semesterId: module.semesterId })
      .from(module)
      .innerJoin(userModule, eq(userModule.moduleId, module.id))
      .where(eq(userModule.userId, this.userId)));
  }

  /** Insert the modules and add them as the user's modules. */
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

    if (!this.data.modules) this.data.modules = [];
    this.data.modules.push(...mods);
  }

  /** Get the folders from the specified module. */
  async activityFolders(moduleId: string): Promise<(typeof activityFolder.$inferInsert)[]> {
    // We're assuming that if insertActivityFolders() is called first and
    // activity folders with the given moduleId are inserted, those inserted
    // activity folders are the only activity folders in that module.
    const cachedFolders = this.data.activityFolders?.get(moduleId);
    if (cachedFolders) return cachedFolders;

    const folders = await db.select().from(activityFolder).where(eq(activityFolder.moduleId, moduleId));

    if (!this.data.activityFolders) this.data.activityFolders = new Map();
    this.data.activityFolders.set(moduleId, folders);
    return folders;
  }

  /** Insert the given activity folders. */
  async insertActivityFolders(folders: (typeof activityFolder.$inferInsert)[]) {
    if (!folders.length) return;

    await db
      .insert(activityFolder)
      .values(folders)
      .onConflictDoUpdate({
        target: activityFolder.id,
        set: {
          name: sql.raw(`excluded.${activityFolder.name.name}`),
          description: sql.raw(`excluded.${activityFolder.description.name}`),
          parentId: sql.raw(`excluded.${activityFolder.parentId.name}`),
          moduleId: sql.raw(`excluded.${activityFolder.moduleId.name}`),
        },
      });

    if (!this.data.activityFolders) this.data.activityFolders = new Map();
    for (const f of folders) {
      if (!this.data.activityFolders.has(f.moduleId)) this.data.activityFolders.set(f.moduleId, []);
      this.data.activityFolders.get(f.moduleId)!.push(f);
    }
  }

  /** Get the activities with the specified `moduleId`. */
  async activities(moduleId: string): Promise<(typeof activity.$inferInsert)[]> {
    // We're assuming that if insertActivities() is called first
    // and activities of the specified module are inserted, those
    // inserted activities are the only activities in that module.
    const cachedActivities = this.data.activities?.get(moduleId);
    if (cachedActivities) return cachedActivities;

    const activities = await db
      .select({ ...getTableColumns(activity) })
      .from(activity)
      .innerJoin(activityFolder, eq(activityFolder.id, activity.folderId))
      .where(eq(activityFolder.moduleId, moduleId));

    if (!this.data.activities) this.data.activities = new Map();
    this.data.activities.set(moduleId, activities);
    return activities;
  }

  /** Insert the given activities. */
  async insertActivities(acts: (typeof activity.$inferInsert)[]) {
    if (!acts.length) return;

    await db
      .insert(activity)
      .values(acts)
      .onConflictDoUpdate({
        target: activity.id,
        set: {
          name: sql.raw(`excluded.${activity.name.name}`),
          type: sql.raw(`excluded.${activity.type.name}`),
          folderId: sql.raw(`excluded.${activity.folderId.name}`),
        },
      });
  }
}

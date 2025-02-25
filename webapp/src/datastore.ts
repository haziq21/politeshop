import { eq, getTableColumns, sql } from "drizzle-orm";
import {
  db,
  school,
  user,
  semester,
  module,
  userModule,
  activityFolder,
  activity,
  type AnyActivity,
  htmlActivity,
  webEmbedActivity,
  docEmbedActivity,
  videoEmbedActivity,
  submissionActivity,
  quizActivity,
  type Semester,
  type Module,
  type ActivityFolder,
  type School,
  type User,
} from "./db";
import { PgColumn, PgTable, type PgUpdateSetSource } from "drizzle-orm/pg-core";

const excluded = (col: PgColumn) => sql.raw(`excluded.${col.name}`);

/** An interface to the POLITEShop database with local caching. */
export class Datastore {
  data: {
    school?: School;
    user?: User;
    semesters?: Semester[];
    modules?: Module[];
    /** Map of module IDs to activity folders. */
    activityFolders?: Map<string, ActivityFolder[]>;
    /** Map of module IDs to activities. */
    activities?: Map<string, AnyActivity[]>;
  } = {};

  constructor(public userId: string) {}

  /** Get the current user. */
  async user(): Promise<User> {
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
  async insertUser(u: User): Promise<boolean> {
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
  async school(): Promise<School> {
    if (this.data.school) return this.data.school;

    return (this.data.school = (
      await db
        .select({ ...getTableColumns(school) })
        .from(user)
        .innerJoin(school, eq(school.id, user.schoolId))
        .where(eq(user.id, this.userId))
    )[0]);
  }

  /** Insert the school. */
  async insertSchool(s: School) {
    await db
      .insert(school)
      .values(s)
      .onConflictDoUpdate({ target: school.id, set: { name: s.name, bannerImageURL: s.bannerImageURL } });
    this.data.school = s;
  }

  /** Get semesters the user is in. */
  async semesters(): Promise<Semester[]> {
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
  async insertSemesters(s: Semester[]) {
    await db
      .insert(semester)
      .values(s)
      .onConflictDoUpdate({ target: semester.id, set: { name: excluded(semester.name) } });

    if (!this.data.semesters) this.data.semesters = [];
    this.data.semesters.push(...s);
  }

  /** Get every module the user has. */
  async modules(): Promise<Module[]> {
    // We're assuming that if insertAndAssociateModules() is called
    // first, the inserted modules are the only modules the user has.
    if (this.data.modules) return this.data.modules;

    return (this.data.modules = await db
      .select(getTableColumns(module))
      .from(module)
      .innerJoin(userModule, eq(userModule.moduleId, module.id))
      .where(eq(userModule.userId, this.userId)));
  }

  /** Insert the modules and add them as the user's modules. */
  async insertAndAssociateModules(mods: Module[]) {
    await db
      .insert(module)
      .values(mods)
      .onConflictDoUpdate({
        target: module.id,
        set: {
          name: excluded(module.name),
          code: excluded(module.code),
          semesterId: excluded(module.semesterId),
          imageIconURL: excluded(module.imageIconURL),
          textUpdatedAt: sql`
            case
              when ${module.name} is distinct from ${excluded(module.name)}
                or ${module.code} is distinct from ${excluded(module.code)}
                then now()
              else ${module.textUpdatedAt}
            end`,
          niceTextUpdatedAt: sql`
            case
              when ${module.niceName} is distinct from ${excluded(module.niceName)}
                or ${module.niceCode} is distinct from ${excluded(module.niceCode)}
                then now()
              else ${module.niceTextUpdatedAt}
            end`,
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
  async activityFolders(moduleId: string): Promise<ActivityFolder[]> {
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
  async insertActivityFolders(folders: ActivityFolder[]) {
    if (!folders.length) return;

    await db
      .insert(activityFolder)
      .values(folders)
      .onConflictDoUpdate({
        target: activityFolder.id,
        set: {
          name: excluded(activityFolder.name),
          description: excluded(activityFolder.description),
          parentId: excluded(activityFolder.parentId),
          moduleId: excluded(activityFolder.moduleId),
        },
      });

    if (!this.data.activityFolders) this.data.activityFolders = new Map();
    for (const f of folders) {
      if (!this.data.activityFolders.has(f.moduleId)) this.data.activityFolders.set(f.moduleId, []);
      this.data.activityFolders.get(f.moduleId)!.push(f);
    }
  }

  /** Get the activities with the specified `moduleId`. */
  async activities(moduleId: string): Promise<AnyActivity[]> {
    // We're assuming that if insertActivities() is called first
    // and activities of the specified module are inserted, those
    // inserted activities are the only activities in that module.
    const cachedActivities = this.data.activities?.get(moduleId);
    if (cachedActivities) return cachedActivities;

    const activities = (
      await db
        .select()
        .from(activity)
        .innerJoin(activityFolder, eq(activityFolder.id, activity.folderId))
        .leftJoin(htmlActivity, eq(htmlActivity.id, activity.id))
        .leftJoin(webEmbedActivity, eq(webEmbedActivity.id, activity.id))
        .leftJoin(docEmbedActivity, eq(docEmbedActivity.id, activity.id))
        .leftJoin(videoEmbedActivity, eq(videoEmbedActivity.id, activity.id))
        .leftJoin(submissionActivity, eq(submissionActivity.id, activity.id))
        .leftJoin(quizActivity, eq(quizActivity.id, activity.id))
        .where(eq(activityFolder.moduleId, moduleId))
    ).map((a) => {
      if (a.activity.type === "html") return { ...a.activity, ...a.html_activity };
      if (a.activity.type === "web_embed") return { ...a.activity, ...a.web_embed_activity };
      if (a.activity.type === "doc_embed") return { ...a.activity, ...a.doc_embed_activity };
      if (a.activity.type === "video_embed") return { ...a.activity, ...a.video_embed_activity };
      if (a.activity.type === "submission") return { ...a.activity, ...a.submission_activity };
      if (a.activity.type === "quiz") return { ...a.activity, ...a.quiz_activity };
      return a.activity;
    }) as AnyActivity[];

    if (!this.data.activities) this.data.activities = new Map();
    this.data.activities.set(moduleId, activities);
    return activities;
  }

  /** Insert the given activities. */
  async insertActivities(acts: AnyActivity[]) {
    if (!acts.length) return;

    await db
      .insert(activity)
      .values(acts)
      .onConflictDoUpdate({
        target: activity.id,
        set: {
          name: excluded(activity.name),
          type: excluded(activity.type),
          folderId: excluded(activity.folderId),
        },
      });

    // Helper function for the tedious inserts below
    const upsertActivityDetails = <T extends PgTable>(
      table: T,
      target: PgColumn,
      value: T["$inferInsert"],
      set?: PgUpdateSetSource<T>
    ) =>
      db
        .insert(table)
        .values(value)
        .onConflictDoUpdate({ target, set: set || value });

    await Promise.all(
      acts.map((a) =>
        a.type === "html"
          ? upsertActivityDetails(htmlActivity, htmlActivity.id, a)
          : a.type === "web_embed"
          ? upsertActivityDetails(webEmbedActivity, webEmbedActivity.id, a)
          : a.type === "doc_embed"
          ? upsertActivityDetails(docEmbedActivity, docEmbedActivity.id, a)
          : a.type === "video_embed"
          ? upsertActivityDetails(videoEmbedActivity, videoEmbedActivity.id, a)
          : a.type === "submission"
          ? upsertActivityDetails(submissionActivity, submissionActivity.id, a)
          : a.type === "quiz"
          ? upsertActivityDetails(quizActivity, quizActivity.id, a)
          : undefined
      )
    );
  }
}

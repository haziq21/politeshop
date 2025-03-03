import { eq, getTableColumns, gt, isNull, lt, or, sql } from "drizzle-orm";
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

/** A high(er)-level interface to the POLITEShop database with local caching. */
export class Repository {
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
    this.data.user = (await db.select().from(user).where(eq(user.id, this.userId)))[0];
    return this.data.user;
  }

  /** Whether the user exists in the database. */
  async userExists(): Promise<boolean> {
    return (await db.select().from(user).where(eq(user.id, this.userId))).length > 0;
  }

  /**
   * Upsert the user into the database, returning `true` if
   * the user was not already present, and `false` otherwise.
   */
  async upsertUser(u: User): Promise<boolean> {
    const { userInserted } = (
      await db
        .insert(user)
        .values(u)
        .onConflictDoUpdate({ target: user.id, set: u })
        .returning({ userInserted: sql<boolean>`(xmax = 0)` })
    )[0];
    return userInserted;
  }

  /** Get the user's school. */
  async school(): Promise<School> {
    if (this.data.school) return this.data.school;

    this.data.school = (
      await db
        .select({ ...getTableColumns(school) })
        .from(user)
        .innerJoin(school, eq(school.id, user.schoolId))
        .where(eq(user.id, this.userId))
    )[0];

    return this.data.school;
  }

  /** Upsert the school. */
  async upsertSchool(s: School) {
    await db.insert(school).values(s).onConflictDoUpdate({ target: school.id, set: s });
  }

  /** Get semesters the user is in. */
  async semesters(): Promise<Semester[]> {
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

  /** Upsert semesters. */
  async upsertSemesters(s: Semester[]) {
    await db
      .insert(semester)
      .values(s)
      .onConflictDoUpdate({ target: semester.id, set: { name: excluded(semester.name) } });
  }

  /** Get the specified module. */
  async module(moduleId: string): Promise<Module> {
    return (await db.select().from(module).where(eq(module.id, moduleId)))[0];
  }

  /** Get every module the user is enrolled in. */
  async modules(): Promise<Module[]> {
    if (this.data.modules) return this.data.modules;

    this.data.modules = await db
      .select(getTableColumns(module))
      .from(module)
      .innerJoin(userModule, eq(userModule.moduleId, module.id))
      .where(eq(userModule.userId, this.userId));

    return this.data.modules;
  }

  /**
   * Upsert the modules as modules the user is enrolled in. If a given module in `mods` doesn't
   * specify a `niceName` or `niceCode`, the existing `niceName` and `niceCode` in the database
   * will be retained. Returns the upserted modules with outdated or missing "nice text".
   */
  async upsertAndAssociateModules(mods: Module[]): Promise<Module[]> {
    const sq = db.$with("sq").as(
      db
        .insert(module)
        .values(mods)
        .onConflictDoUpdate({
          target: module.id,
          set: {
            name: excluded(module.name),
            code: excluded(module.code),
            semesterId: excluded(module.semesterId),
            imageIconURL: excluded(module.imageIconURL),

            // Retain the niceName and niceCode if they're already set
            niceName: sql`
            case
              when ${excluded(module.niceName)} is not null then ${excluded(module.niceName)}
              else ${module.niceName}
            end`,
            niceCode: sql`
            case
              when ${excluded(module.niceCode)} is not null then ${excluded(module.niceCode)}
              else ${module.niceCode}
            end`,

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
        })
        .returning()
    );
    const uglyModules = await db
      .with(sq)
      .select()
      .from(sq)
      .where(or(gt(sq.textUpdatedAt, sq.niceTextUpdatedAt), isNull(sq.niceName), isNull(sq.niceCode)));

    await db
      .insert(userModule)
      .values(mods.map((m) => ({ userId: this.userId, moduleId: m.id })))
      .onConflictDoNothing();

    return uglyModules;
  }

  /** Get the folders from the specified module. */
  async activityFolders(moduleId: string): Promise<ActivityFolder[]> {
    const cachedFolders = this.data.activityFolders?.get(moduleId);
    if (cachedFolders) return cachedFolders;

    const folders = await db.select().from(activityFolder).where(eq(activityFolder.moduleId, moduleId));

    if (!this.data.activityFolders) this.data.activityFolders = new Map();
    this.data.activityFolders.set(moduleId, folders);
    return folders;
  }

  /** Upsert the given activity folders. */
  async upsertActivityFolders(folders: ActivityFolder[]) {
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
  }

  /** Get the activities with the specified `moduleId`. */
  async activities(moduleId: string): Promise<AnyActivity[]> {
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

  /** Upsert the given activities. */
  async upsertActivities(acts: AnyActivity[]) {
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
      acts.map((a) => {
        if (a.type === "html") return upsertActivityDetails(htmlActivity, htmlActivity.id, a);
        if (a.type === "web_embed") return upsertActivityDetails(webEmbedActivity, webEmbedActivity.id, a);
        if (a.type === "doc_embed") return upsertActivityDetails(docEmbedActivity, docEmbedActivity.id, a);
        if (a.type === "video_embed") return upsertActivityDetails(videoEmbedActivity, videoEmbedActivity.id, a);
        if (a.type === "submission") return upsertActivityDetails(submissionActivity, submissionActivity.id, a);
        if (a.type === "quiz") return upsertActivityDetails(quizActivity, quizActivity.id, a);
      })
    );
  }
}

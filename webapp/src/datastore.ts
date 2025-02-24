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
} from "./db";

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
    activities?: Map<string, AnyActivity[]>;
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

  /** Insert the school. */
  async insertSchool(s: typeof school.$inferInsert) {
    await db
      .insert(school)
      .values(s)
      .onConflictDoUpdate({ target: school.id, set: { name: s.name, bannerImageURL: s.bannerImageURL } });
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
      .select(getTableColumns(module))
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
          imageIconURL: sql.raw(`excluded.${module.imageIconURL.name}`),
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
          name: sql.raw(`excluded.${activity.name.name}`),
          type: sql.raw(`excluded.${activity.type.name}`),
          folderId: sql.raw(`excluded.${activity.folderId.name}`),
        },
      });

    await Promise.all(
      acts.map(async (a) => {
        if (a.type === "html")
          await db
            .insert(htmlActivity)
            .values(a)
            .onConflictDoUpdate({
              target: htmlActivity.id,
              set: { content: sql.raw(`excluded.${htmlActivity.content.name}`) },
            });
        else if (a.type === "web_embed")
          await db
            .insert(webEmbedActivity)
            .values(a)
            .onConflictDoUpdate({
              target: webEmbedActivity.id,
              set: {
                embedURL: sql.raw(`excluded.${webEmbedActivity.embedURL.name}`),
                newTabURL: sql.raw(`excluded.${webEmbedActivity.newTabURL.name}`),
              },
            });
        else if (a.type === "doc_embed")
          await db
            .insert(docEmbedActivity)
            .values(a)
            .onConflictDoUpdate({
              target: docEmbedActivity.id,
              set: {
                sourceURL: sql.raw(`excluded.${docEmbedActivity.sourceURL.name}`),
                previewURL: sql.raw(`excluded.${docEmbedActivity.previewURL.name}`),
                previewURLExpiry: sql.raw(`excluded.${docEmbedActivity.previewURLExpiry.name}`),
              },
            });
        else if (a.type === "video_embed")
          await db
            .insert(videoEmbedActivity)
            .values(a)
            .onConflictDoUpdate({
              target: videoEmbedActivity.id,
              set: {
                sourceURL: sql.raw(`excluded.${videoEmbedActivity.sourceURL.name}`),
                sourceURLExpiry: sql.raw(`excluded.${videoEmbedActivity.sourceURLExpiry.name}`),
              },
            });
        else if (a.type === "submission")
          await db
            .insert(submissionActivity)
            .values(a)
            .onConflictDoUpdate({
              target: submissionActivity.id,
              set: { dueDate: sql.raw(`excluded.${submissionActivity.dueDate.name}`) },
            });
        else if (a.type === "quiz")
          await db
            .insert(quizActivity)
            .values(a)
            .onConflictDoUpdate({
              target: quizActivity.id,
              set: { dueDate: sql.raw(`excluded.${quizActivity.dueDate.name}`) },
            });
      })
    );
  }
}

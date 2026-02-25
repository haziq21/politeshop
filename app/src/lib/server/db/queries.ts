import {
  and,
  count,
  eq,
  getTableColumns,
  gt,
  isNull,
  lt,
  or,
  SQL,
  sql,
} from "drizzle-orm";
import {
  db,
  organization,
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
  type Organization,
  type User,
  type SemesterBreak,
  semesterBreak,
  userSubmission,
  type UserSubmission,
  type SubmissionDropbox,
  submissionDropbox,
  type Quiz,
  quiz,
  type AnyActivityWithName,
} from ".";
import { PgColumn, PgTable, type PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { CredentialName } from "@politeshop/shared";

const excluded = (col: PgColumn) => sql.raw(`excluded.${col.name}`);

export async function getUserFromSessionHash(
  sessionHash: number,
): Promise<User | null> {
  const u = (
    await db.select().from(user).where(eq(user.sessionHash, sessionHash))
  ).at(0);
  return u ?? null;
}

/** Get the current user. */
export async function getUser(userId: string): Promise<User> {
  return (await db.select().from(user).where(eq(user.id, userId)))[0];
}

/** Whether the user exists in the database. */
export async function userExists(userId: string): Promise<boolean> {
  return (
    (
      await db.select({ count: count() }).from(user).where(eq(user.id, userId))
    )[0].count > 0
  );
}

/**
 * Upsert the user into the database, returning `true` if
 * the user was not already present, and `false` otherwise.
 */
export async function upsertUser(u: User): Promise<boolean> {
  const { userInserted } = (
    await db
      .insert(user)
      .values(u)
      .onConflictDoUpdate({ target: user.id, set: u })
      .returning({ userInserted: sql<boolean>`(xmax = 0)` })
  )[0];
  return userInserted;
}

/**
 * Update the specified user.
 * Return `true` if a row was updated, and `false` otherwise.
 */
export async function updateUser(
  u: Partial<User> & { id: string },
): Promise<boolean> {
  const res = await db.update(user).set(u).where(eq(user.id, u.id));
  return res.rowCount === 1;
}

/**
 * Generate the user's session hash using their session credentials.
 */
export async function getSessionHash(
  credentials: Record<CredentialName, string>,
): Promise<number> {
  const input = [
    credentials.d2lSessionVal,
    credentials.d2lSecureSessionVal,
    credentials.d2lFetchToken,
    credentials.d2lSubdomain,
  ].join(":");

  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return new DataView(hashBuffer).getInt32(0, false);
}

/** Get the user's organization. */
export async function getOrganization(userId: string): Promise<Organization> {
  return (
    await db
      .select(getTableColumns(organization))
      .from(user)
      .innerJoin(organization, eq(organization.id, user.organizationId))
      .where(eq(user.id, userId))
  )[0];
}

/** Upsert the organization. */
export async function upsertOrganization(o: Organization) {
  await db
    .insert(organization)
    .values(o)
    .onConflictDoUpdate({ target: organization.id, set: o });
}

/** Get semesters the user is in. */
export async function getSemesters(userId: string): Promise<Semester[]> {
  return db
    .select({ id: semester.id, name: semester.name })
    .from(semester)
    .innerJoin(module, eq(module.semesterId, semester.id))
    .innerJoin(userModule, eq(userModule.moduleId, module.id))
    .where(eq(userModule.userId, userId))
    .groupBy(semester.id);
}

/** Upsert semesters. */
export async function upsertSemesters(s: Semester[]) {
  await db
    .insert(semester)
    .values(s)
    .onConflictDoUpdate({
      target: semester.id,
      set: { name: excluded(semester.name) },
    });
}

/** Get the specified module. */
export async function getModule(moduleId: string): Promise<Module> {
  return (await db.select().from(module).where(eq(module.id, moduleId)))[0];
}

/** Get every module the user is enrolled in. */
export async function getModules(userId: string): Promise<Module[]> {
  return db
    .select(getTableColumns(module))
    .from(module)
    .innerJoin(userModule, eq(userModule.moduleId, module.id))
    .where(eq(userModule.userId, userId));
}

/**
 * Upsert the modules as modules the user is enrolled in. If a given module in `mods` doesn't
 * specify a `niceName` or `niceCode`, the existing `niceName` and `niceCode` in the database
 * will be retained. Returns the upserted modules with outdated or missing "nice text".
 */
export async function upsertAndAssociateModules(
  userId: string,
  mods: Module[],
): Promise<Module[]> {
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
      .returning(),
  );
  const uglyModules = await db
    .with(sq)
    .select()
    .from(sq)
    .where(
      or(
        gt(sq.textUpdatedAt, sq.niceTextUpdatedAt),
        isNull(sq.niceName),
        isNull(sq.niceCode),
      ),
    );

  await db
    .insert(userModule)
    .values(mods.map((m) => ({ userId, moduleId: m.id })))
    .onConflictDoNothing();

  return uglyModules;
}

/** Get the folders from the specified module. */
export async function getActivityFolders(
  moduleId: string,
): Promise<ActivityFolder[]> {
  return db
    .select()
    .from(activityFolder)
    .where(eq(activityFolder.moduleId, moduleId))
    .orderBy(activityFolder.sortOrder);
}

/** Upsert the given activity folders. */
export async function upsertActivityFolders(folders: ActivityFolder[]) {
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
        sortOrder: excluded(activityFolder.sortOrder),
      },
    });
}

/** Get the activities with the specified `moduleId`. */
export async function getActivities(
  moduleId: string,
): Promise<AnyActivityWithName[]> {
  return (
    await db
      .select()
      .from(activity)
      .innerJoin(activityFolder, eq(activityFolder.id, activity.folderId))
      .leftJoin(htmlActivity, eq(htmlActivity.id, activity.id))
      .leftJoin(webEmbedActivity, eq(webEmbedActivity.id, activity.id))
      .leftJoin(docEmbedActivity, eq(docEmbedActivity.id, activity.id))
      .leftJoin(videoEmbedActivity, eq(videoEmbedActivity.id, activity.id))
      .leftJoin(submissionActivity, eq(submissionActivity.id, activity.id))
      .leftJoin(
        submissionDropbox,
        eq(submissionDropbox.id, submissionActivity.dropboxId),
      )
      .leftJoin(quizActivity, eq(quizActivity.id, activity.id))
      .leftJoin(quiz, eq(quiz.id, quizActivity.quizId))
      .where(eq(activityFolder.moduleId, moduleId))
      .orderBy(activity.sortOrder)
  ).map((a) => {
    if (a.activity.type === "html")
      return { ...a.activity, ...a.html_activity };
    if (a.activity.type === "web_embed")
      return { ...a.activity, ...a.web_embed_activity };
    if (a.activity.type === "doc_embed")
      return { ...a.activity, ...a.doc_embed_activity };
    if (a.activity.type === "video_embed")
      return { ...a.activity, ...a.video_embed_activity };
    if (a.activity.type === "submission")
      return {
        ...a.activity,
        ...a.submission_activity,
        name: a.submission_dropbox!.name,
      };
    if (a.activity.type === "quiz")
      return { ...a.activity, ...a.quiz_activity, name: a.quiz!.name };
    return a.activity;
  }) as AnyActivityWithName[];
}

/** Upsert the given activities. */
export async function upsertActivities(acts: AnyActivity[]) {
  if (!acts.length) return;

  await db
    .insert(activity)
    .values(acts)
    .onConflictDoUpdate({
      target: activity.id,
      set: {
        type: excluded(activity.type),
        folderId: excluded(activity.folderId),
        sortOrder: excluded(activity.sortOrder),
      },
    });

  // Helper function for the tedious inserts below
  const upsertActivityDetails = <T extends PgTable>(
    table: T,
    target: PgColumn,
    value: T["$inferInsert"],
    set?: PgUpdateSetSource<T>,
  ) =>
    db
      .insert(table)
      .values(value)
      .onConflictDoUpdate({ target, set: set || value });

  await Promise.all(
    acts.map((a) => {
      if (a.type === "html")
        return upsertActivityDetails(htmlActivity, htmlActivity.id, a);
      if (a.type === "web_embed")
        return upsertActivityDetails(webEmbedActivity, webEmbedActivity.id, a);
      if (a.type === "doc_embed")
        return upsertActivityDetails(docEmbedActivity, docEmbedActivity.id, a);
      if (a.type === "video_embed")
        return upsertActivityDetails(
          videoEmbedActivity,
          videoEmbedActivity.id,
          a,
        );
      if (a.type === "submission")
        return upsertActivityDetails(
          submissionActivity,
          submissionActivity.id,
          a,
        );
      if (a.type === "quiz")
        return upsertActivityDetails(quizActivity, quizActivity.id, a);
    }),
  );
}

export async function upsertSubmissionDropboxes(
  dropboxes: SubmissionDropbox[],
) {
  if (!dropboxes.length) return;

  await db
    .insert(submissionDropbox)
    .values(dropboxes)
    .onConflictDoUpdate({
      target: submissionDropbox.id,
      set: {
        name: excluded(submissionDropbox.name),
        moduleId: excluded(submissionDropbox.moduleId),
        description: excluded(submissionDropbox.description),
        dueAt: excluded(submissionDropbox.dueAt),
      },
    });
}

export async function upsertQuizzes(quizzes: Quiz[]) {
  if (!quizzes.length) return;

  await db
    .insert(quiz)
    .values(quizzes)
    .onConflictDoUpdate({
      target: quiz.id,
      set: {
        name: excluded(quiz.name),
        moduleId: excluded(quiz.moduleId),
        description: excluded(quiz.description),
        dueAt: excluded(quiz.dueAt),
      },
    });
}

export async function upsertUserSubmissions(submissions: UserSubmission[]) {
  if (!submissions.length) return;

  await db
    .insert(userSubmission)
    .values(submissions)
    .onConflictDoUpdate({
      target: userSubmission.id,
      set: {
        userId: excluded(userSubmission.userId),
        dropboxId: excluded(userSubmission.dropboxId),
        submittedAt: excluded(userSubmission.submittedAt),
        comment: excluded(userSubmission.comment),
      },
    });
}

/**
 * Get the current semester break, or next semester break if there isn't currently
 * a semester break, or `undefined` if there are no more semester breaks.
 */
export async function currentOrNextSemesterBreak(userId: string): Promise<
  | (SemesterBreak & {
      isCurrent: boolean;
      daysToStart: number;
      daysToEnd: number;
    })
  | undefined
> {
  return (
    await db
      .select({
        ...getTableColumns(semesterBreak),
        isCurrent: lt(semesterBreak.startDate, sql`now()`) as SQL<boolean>,
        daysToStart: sql<number>`extract(day from ${semesterBreak.startDate} - now())`,
        // +1 because the end date is inclusive
        daysToEnd: sql<number>`extract(day from ${semesterBreak.endDate} - now()) + 1`,
      })
      .from(semesterBreak)
      .innerJoin(
        organization,
        eq(organization.id, semesterBreak.organizationId),
      )
      .innerJoin(user, eq(user.organizationId, organization.id))
      .where(
        and(
          eq(user.id, userId),
          or(
            and(
              lt(semesterBreak.startDate, sql`now()`),
              lt(sql`now()`, semesterBreak.endDate),
            ),
            lt(sql`now()`, semesterBreak.startDate),
          ),
        ),
      )
      .orderBy(semesterBreak.startDate)
      .limit(1)
  ).at(0);
}

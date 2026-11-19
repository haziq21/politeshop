import {
  and,
  count,
  countDistinct,
  eq,
  getTableColumns,
  gt,
  isNotNull,
  isNull,
  lt,
  notInArray,
  or,
  SQL,
  sql,
} from "drizzle-orm";
import { PgColumn } from "drizzle-orm/pg-core";

import {
  db,
  organization,
  user,
  semester,
  module,
  userModule,
  folderActivity,
  baseActivity,
  type AnyActivity,
  type BaseActivity,
  htmlActivity,
  webEmbedActivity,
  docEmbedActivity,
  videoEmbedActivity,
  submissionActivity,
  quizActivity,
  type Semester,
  type Module,
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
  userActivityAccess,
} from ".";

const excluded = (col: PgColumn) => sql.raw(`excluded.${col.name}`);

export async function getUserFromSessionHash(sessionHash: number): Promise<User | null> {
  const u = (await db.select().from(user).where(eq(user.sessionHash, sessionHash))).at(0);
  return u ?? null;
}

/** Get the current user. */
export async function getUser(userId: string): Promise<User> {
  return (await db.select().from(user).where(eq(user.id, userId)))[0];
}

/** Whether the user exists in the database. */
export async function userExists(userId: string): Promise<boolean> {
  return (await db.select({ count: count() }).from(user).where(eq(user.id, userId)))[0].count > 0;
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
export async function updateUser(u: Partial<User> & { id: string }): Promise<boolean> {
  const res = await db.update(user).set(u).where(eq(user.id, u.id));
  return res.rowCount === 1;
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
  await db.insert(organization).values(o).onConflictDoUpdate({ target: organization.id, set: o });
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
export async function upsertAndAssociateModules(userId: string, mods: Module[]): Promise<Module[]> {
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
    .where(or(gt(sq.textUpdatedAt, sq.niceTextUpdatedAt), isNull(sq.niceName), isNull(sq.niceCode)));

  await db
    .insert(userModule)
    .values(mods.map((m) => ({ userId, moduleId: m.id })))
    .onConflictDoNothing();

  return uglyModules;
}

/** Get every activity in the module, folders included, without their type-specific details. */
export async function getBaseActivities(moduleId: string): Promise<BaseActivity[]> {
  return db.select().from(baseActivity).where(eq(baseActivity.moduleId, moduleId)).orderBy(baseActivity.sortOrder);
}

/** Get a single activity by ID, with its type-specific details. */
export async function getActivity(activityId: string): Promise<AnyActivity | null> {
  const row = (
    await db
      .select()
      .from(baseActivity)
      .leftJoin(folderActivity, eq(folderActivity.id, baseActivity.id))
      .leftJoin(htmlActivity, eq(htmlActivity.id, baseActivity.id))
      .leftJoin(webEmbedActivity, eq(webEmbedActivity.id, baseActivity.id))
      .leftJoin(docEmbedActivity, eq(docEmbedActivity.id, baseActivity.id))
      .leftJoin(videoEmbedActivity, eq(videoEmbedActivity.id, baseActivity.id))
      .leftJoin(submissionActivity, eq(submissionActivity.id, baseActivity.id))
      .leftJoin(quizActivity, eq(quizActivity.id, baseActivity.id))
      .where(eq(baseActivity.id, activityId))
  ).at(0);
  if (!row) return null;

  // The joins that don't match the activity's type are null, and spreading null adds nothing
  return {
    ...row.base_activity,
    ...row.folder_activity,
    ...row.html_activity,
    ...row.web_embed_activity,
    ...row.doc_embed_activity,
    ...row.video_embed_activity,
    ...row.submission_activity,
    ...row.quiz_activity,
  } as AnyActivity;
}

/** Upsert the given activities, in one statement per table however many there are. */
export async function upsertActivities(acts: AnyActivity[]) {
  if (!acts.length) return;

  // parent_id references activity itself, so a folder and its children can go in one statement
  await db
    .insert(baseActivity)
    .values(acts)
    .onConflictDoUpdate({
      target: baseActivity.id,
      set: {
        type: excluded(baseActivity.type),
        name: excluded(baseActivity.name),
        moduleId: excluded(baseActivity.moduleId),
        parentId: excluded(baseActivity.parentId),
        sortOrder: excluded(baseActivity.sortOrder),
      },
    });

  const folders = acts.filter((a) => a.type === "folder");
  const htmls = acts.filter((a) => a.type === "html");
  const webEmbeds = acts.filter((a) => a.type === "web_embed");
  const docEmbeds = acts.filter((a) => a.type === "doc_embed");
  const videoEmbeds = acts.filter((a) => a.type === "video_embed");
  const submissions = acts.filter((a) => a.type === "submission");
  const quizzes = acts.filter((a) => a.type === "quiz");

  await Promise.all([
    folders.length &&
      db
        .insert(folderActivity)
        .values(folders)
        .onConflictDoUpdate({
          target: folderActivity.id,
          set: { description: excluded(folderActivity.description) },
        }),
    htmls.length &&
      db
        .insert(htmlActivity)
        .values(htmls)
        .onConflictDoUpdate({ target: htmlActivity.id, set: { content: excluded(htmlActivity.content) } }),
    webEmbeds.length &&
      db
        .insert(webEmbedActivity)
        .values(webEmbeds)
        .onConflictDoUpdate({ target: webEmbedActivity.id, set: { url: excluded(webEmbedActivity.url) } }),
    docEmbeds.length &&
      db
        .insert(docEmbedActivity)
        .values(docEmbeds)
        .onConflictDoUpdate({
          target: docEmbedActivity.id,
          set: {
            sourceURL: excluded(docEmbedActivity.sourceURL),
            previewURL: excluded(docEmbedActivity.previewURL),
            previewURLExpiry: excluded(docEmbedActivity.previewURLExpiry),
          },
        }),
    videoEmbeds.length &&
      db
        .insert(videoEmbedActivity)
        .values(videoEmbeds)
        .onConflictDoUpdate({
          target: videoEmbedActivity.id,
          set: {
            sourceURL: excluded(videoEmbedActivity.sourceURL),
            sourceURLExpiry: excluded(videoEmbedActivity.sourceURLExpiry),
            thumbnailURL: excluded(videoEmbedActivity.thumbnailURL),
            thumbnailURLExpiry: excluded(videoEmbedActivity.thumbnailURLExpiry),
          },
        }),
    submissions.length &&
      db
        .insert(submissionActivity)
        .values(submissions)
        .onConflictDoUpdate({
          target: submissionActivity.id,
          set: { dropboxId: excluded(submissionActivity.dropboxId) },
        }),
    quizzes.length &&
      db
        .insert(quizActivity)
        .values(quizzes)
        .onConflictDoUpdate({ target: quizActivity.id, set: { quizId: excluded(quizActivity.quizId) } }),
  ]);
}

/** Insert dropboxes that don't exist yet, leaving existing ones as they are. */
export async function insertMissingSubmissionDropboxes(
  dropboxes: Pick<SubmissionDropbox, "id" | "moduleId" | "name">[],
) {
  if (!dropboxes.length) return;

  await db.insert(submissionDropbox).values(dropboxes).onConflictDoNothing();
}

/** Insert quizzes that don't exist yet, leaving existing ones as they are. */
export async function insertMissingQuizzes(quizzes: Pick<Quiz, "id" | "moduleId" | "name">[]) {
  if (!quizzes.length) return;

  await db.insert(quiz).values(quizzes).onConflictDoNothing();
}

export async function upsertSubmissionDropboxes(dropboxes: SubmissionDropbox[]) {
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
      .innerJoin(organization, eq(organization.id, semesterBreak.organizationId))
      .innerJoin(user, eq(user.organizationId, organization.id))
      .where(
        and(
          eq(user.id, userId),
          or(
            and(lt(semesterBreak.startDate, sql`now()`), lt(sql`now()`, semesterBreak.endDate)),
            lt(sql`now()`, semesterBreak.startDate),
          ),
        ),
      )
      .orderBy(semesterBreak.startDate)
      .limit(1)
  ).at(0);
}

export async function setUserActivityAccess(userId: string, activityIds: string[]) {
  await db
    .insert(userActivityAccess)
    .values(activityIds.map((activityId) => ({ userId, activityId })))
    .onConflictDoNothing();

  await db
    .delete(userActivityAccess)
    .where(and(eq(userActivityAccess.userId, userId), notInArray(userActivityAccess.activityId, activityIds)));
}

/** Get the submission dropboxes and quizzes with due dates across every module the user is enrolled in. */
export async function getDueItems(userId: string) {
  const moduleCode = sql<string>`coalesce(nullif(${module.niceCode}, ''), ${module.code})`;

  const [dropboxes, quizzes] = await Promise.all([
    db
      .select({
        id: submissionDropbox.id,
        title: submissionDropbox.name,
        dueAt: submissionDropbox.dueAt,
        moduleCode,
        submissionCount: countDistinct(userSubmission.id),
      })
      .from(submissionDropbox)
      .innerJoin(module, eq(module.id, submissionDropbox.moduleId))
      .innerJoin(userModule, and(eq(userModule.moduleId, module.id), eq(userModule.userId, userId)))
      .leftJoin(
        userSubmission,
        and(
          eq(userSubmission.dropboxId, submissionDropbox.id),
          eq(userSubmission.userId, userId),
          isNotNull(userSubmission.submittedAt),
        ),
      )
      .where(isNotNull(submissionDropbox.dueAt))
      .groupBy(submissionDropbox.id, module.id),
    db
      .select({
        id: quiz.id,
        title: quiz.name,
        dueAt: quiz.dueAt,
        moduleCode,
      })
      .from(quiz)
      .innerJoin(module, eq(module.id, quiz.moduleId))
      .innerJoin(userModule, and(eq(userModule.moduleId, module.id), eq(userModule.userId, userId)))
      .where(isNotNull(quiz.dueAt))
      .groupBy(quiz.id, module.id),
  ]);

  return { dropboxes, quizzes };
}

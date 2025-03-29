import { integer, pgEnum, pgTable, primaryKey, timestamp, text, type AnyPgColumn, date } from "drizzle-orm/pg-core";

export const organization = pgTable("organization", {
  id: text().primaryKey(),
  name: text().notNull(),
  bannerImageURL: text("banner_image_url"),
  academicCalendarLink: text("academic_calendar_link"),
});

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id),
});

export const semester = pgTable("semester", {
  id: text().primaryKey(),
  name: text().notNull(),
});

// TOOD: Perhaps we could store schools (e.g. NP's School of ICT) too
// export const school = pgTable("school", {
//   id: text().primaryKey(),
//   name: text().notNull(),
//   code: text().notNull(),
//   organizationId: text("organization_id")
//     .notNull()
//     .references(() => organization.id, { onDelete: "cascade", onUpdate: "cascade" }),
// });

export const module = pgTable("module", {
  id: text().primaryKey(),
  name: text().notNull(),
  niceName: text("nice_name"),
  code: text().notNull(),
  niceCode: text("nice_code"),
  textUpdatedAt: timestamp("text_updated_at", { withTimezone: true }).notNull().defaultNow(),
  niceTextUpdatedAt: timestamp("nice_text_updated_at", { withTimezone: true }).notNull().defaultNow(),
  semesterId: text("semester_id")
    .notNull()
    .references(() => semester.id, { onDelete: "cascade", onUpdate: "cascade" }),
  imageIconURL: text("image_icon_url"),
});

export const userModule = pgTable(
  "user_module",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    moduleId: text("module_id")
      .notNull()
      .references(() => module.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.moduleId] })]
);

export const activityFolder = pgTable("activity_folder", {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text(),
  parentId: text("parent_id").references((): AnyPgColumn => activityFolder.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  moduleId: text("module_id")
    .notNull()
    .references(() => module.id, { onDelete: "cascade", onUpdate: "cascade" }),
  sortOrder: integer("sort_order").notNull(),
});

export const activityTypeEnum = pgEnum("activity_type", [
  "html",
  "web_embed",
  "doc_embed",
  "video_embed",
  "submission",
  "quiz",
  "unknown",
]);

export const activity = pgTable("activity", {
  id: text().primaryKey(),
  type: activityTypeEnum().notNull(),
  folderId: text("folder_id")
    .notNull()
    .references(() => activityFolder.id, { onDelete: "cascade", onUpdate: "cascade" }),
  sortOrder: integer("sort_order").notNull(),
});

export const htmlActivity = pgTable("html_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  name: text().notNull(),
  content: text().notNull(),
});

export const webEmbedActivity = pgTable("web_embed_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  name: text().notNull(),
  url: text("url").notNull(),
});

export const docEmbedActivity = pgTable("doc_embed_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  name: text().notNull(),
  sourceURL: text("source_url").notNull(),
  previewURL: text("preview_url"),
  previewURLExpiry: timestamp("preview_url_expiry", { withTimezone: true }),
});

export const videoEmbedActivity = pgTable("video_embed_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  name: text().notNull(),
  sourceURL: text("source_url").notNull(),
  sourceURLExpiry: timestamp("source_url_expiry", { withTimezone: true }),
  thumbnailURL: text("thumbnail_url"),
  thumbnailURLExpiry: timestamp("thumbnail_url_expiry", { withTimezone: true }),
});

export const submissionActivity = pgTable("submission_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  dropboxId: text("dropbox_id")
    .notNull()
    .references(() => submissionDropbox.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const quizActivity = pgTable("quiz_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quiz.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const submissionDropbox = pgTable("submission_dropbox", {
  id: text().primaryKey(),
  moduleId: text("module_id")
    .notNull()
    .references(() => module.id, { onDelete: "cascade", onUpdate: "cascade" }),
  name: text().notNull(),
  description: text(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  closesAt: timestamp("closes_at", { withTimezone: true }),
});

export const quiz = pgTable("quiz", {
  id: text().primaryKey(),
  moduleId: text("module_id")
    .notNull()
    .references(() => module.id, { onDelete: "cascade", onUpdate: "cascade" }),
  name: text().notNull(),
  description: text(),
  dueAt: timestamp("due_at", { withTimezone: true }),
});

export const userSubmission = pgTable("user_submission", {
  id: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
  dropboxId: text("dropbox_id")
    .notNull()
    .references(() => submissionDropbox.id, { onDelete: "cascade", onUpdate: "cascade" }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  comment: text(),
});

export const submissionFile = pgTable("submission_file", {
  id: text().primaryKey(),
  submissionId: text("submission_id")
    .notNull()
    .references(() => userSubmission.id, { onDelete: "cascade", onUpdate: "cascade" }),
  name: text().notNull(),
  url: text().notNull(),
  size: integer().notNull(),
});

export const defaultSemesterFilter = pgTable("default_semester_filter", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
  semesterId: text("semester_id").references(() => semester.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const semesterBreak = pgTable("semester_break", {
  organization: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade", onUpdate: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  name: text().notNull(),
});

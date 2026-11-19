import { sql } from "drizzle-orm";
import { integer, pgEnum, pgTable, primaryKey, text, type AnyPgColumn, uniqueIndex } from "drizzle-orm/pg-core";

import { date, timestamptz } from "./temporal";

export const organization = pgTable("organization", {
  id: text().primaryKey(),
  name: text().notNull(),
  bannerImageURL: text("banner_image_url"),
  academicCalendarLink: text("academic_calendar_link"),
});

export const user = pgTable(
  "user",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    sessionHash: integer("session_hash").notNull(),
  },
  (table) => [uniqueIndex().on(table.sessionHash)],
);

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
  textUpdatedAt: timestamptz("text_updated_at")
    .notNull()
    .default(sql`now()`),
  niceTextUpdatedAt: timestamptz("nice_text_updated_at")
    .notNull()
    .default(sql`now()`),
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
  (table) => [primaryKey({ columns: [table.userId, table.moduleId] })],
);

export const activityTypeEnum = pgEnum("activity_type", [
  "folder",
  "html",
  "web_embed",
  "doc_embed",
  "video_embed",
  "submission",
  "quiz",
  "unknown",
]);

export const baseActivity = pgTable("base_activity", {
  id: text().primaryKey(),
  type: activityTypeEnum().notNull(),
  name: text().notNull(),
  moduleId: text("module_id")
    .notNull()
    .references(() => module.id, { onDelete: "cascade", onUpdate: "cascade" }),
  parentId: text("parent_id").references((): AnyPgColumn => baseActivity.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  sortOrder: integer("sort_order").notNull(),
});

export const folderActivity = pgTable("folder_activity", {
  id: text()
    .primaryKey()
    .references(() => baseActivity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  description: text().notNull(),
});

export const htmlActivity = pgTable("html_activity", {
  id: text()
    .primaryKey()
    .references(() => baseActivity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  content: text().notNull(),
});

export const webEmbedActivity = pgTable("web_embed_activity", {
  id: text()
    .primaryKey()
    .references(() => baseActivity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  url: text("url").notNull(),
});

export const docEmbedActivity = pgTable("doc_embed_activity", {
  id: text()
    .primaryKey()
    .references(() => baseActivity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  sourceURL: text("source_url").notNull(),
  previewURL: text("preview_url"),
  previewURLExpiry: timestamptz("preview_url_expiry"),
});

export const videoEmbedActivity = pgTable("video_embed_activity", {
  id: text()
    .primaryKey()
    .references(() => baseActivity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  sourceURL: text("source_url").notNull(),
  sourceURLExpiry: timestamptz("source_url_expiry"),
  thumbnailURL: text("thumbnail_url"),
  thumbnailURLExpiry: timestamptz("thumbnail_url_expiry"),
});

export const submissionActivity = pgTable("submission_activity", {
  id: text()
    .primaryKey()
    .references(() => baseActivity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  dropboxId: text("dropbox_id")
    .notNull()
    .references(() => submissionDropbox.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const quizActivity = pgTable("quiz_activity", {
  id: text()
    .primaryKey()
    .references(() => baseActivity.id, { onDelete: "cascade", onUpdate: "cascade" }),
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
  dueAt: timestamptz("due_at"),
  opensAt: timestamptz("opens_at"),
  closesAt: timestamptz("closes_at"),
});

export const quiz = pgTable("quiz", {
  id: text().primaryKey(),
  moduleId: text("module_id")
    .notNull()
    .references(() => module.id, { onDelete: "cascade", onUpdate: "cascade" }),
  name: text().notNull(),
  description: text(),
  dueAt: timestamptz("due_at"),
});

export const userSubmission = pgTable("user_submission", {
  id: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
  dropboxId: text("dropbox_id")
    .notNull()
    .references(() => submissionDropbox.id, { onDelete: "cascade", onUpdate: "cascade" }),
  submittedAt: timestamptz("submitted_at"),
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

export const semesterBreak = pgTable("semester_break", {
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade", onUpdate: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  name: text().notNull(),
});

export const userActivityAccess = pgTable(
  "user_activity_access",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    activityId: text("activity_id")
      .notNull()
      .references(() => baseActivity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.activityId] })],
);

import { integer, pgEnum, pgTable, primaryKey, timestamp, text, type AnyPgColumn, date } from "drizzle-orm/pg-core";

export const school = pgTable("school", {
  id: text().primaryKey(),
  name: text().notNull(),
  bannerImageURL: text("banner_image_url"),
  academicCalendarLink: text("academic_calendar_link"),
});

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  schoolId: text("school_id")
    .notNull()
    .references(() => school.id),
});

export const semester = pgTable("semester", {
  id: text().primaryKey(),
  name: text().notNull(),
});

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
  name: text().notNull(),
  type: activityTypeEnum().notNull(),
  folderId: text("folder_id")
    .notNull()
    .references(() => activityFolder.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const htmlActivity = pgTable("html_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  content: text().notNull(),
});

export const webEmbedActivity = pgTable("web_embed_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  embedURL: text("embed_url").notNull(),
  newTabURL: text("new_tab_url"),
});

export const docEmbedActivity = pgTable("doc_embed_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  sourceURL: text("source_url").notNull(),
  previewURL: text("preview_url"),
  previewURLExpiry: timestamp("preview_url_expiry", { withTimezone: true }),
});

export const videoEmbedActivity = pgTable("video_embed_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  sourceURL: text("source_url").notNull(),
  sourceURLExpiry: timestamp("source_url_expiry", { withTimezone: true }),
});

export const submissionActivity = pgTable("submission_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  description: text(),
});

export const quizActivity = pgTable("quiz_activity", {
  id: text()
    .primaryKey()
    .references(() => activity.id, { onDelete: "cascade", onUpdate: "cascade" }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  description: text(),
  attemptsAllowed: integer("attempts_allowed"),
  attemptsCompleted: integer("attempts_completed"),
});

export const defaultSemesterFilter = pgTable("default_semester_filter", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
  semesterId: text("semester_id").references(() => semester.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const semesterBreak = pgTable("semester_break", {
  schoolId: text("school_id")
    .notNull()
    .references(() => school.id, { onDelete: "cascade", onUpdate: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  name: text().notNull(),
});

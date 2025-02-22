import { foreignKey, pgEnum, pgTable, primaryKey, varchar, type AnyPgColumn } from "drizzle-orm/pg-core";

export const activityTypeEnum = pgEnum("activity_type", ["html", "file", "submission", "quiz"]);

export const school = pgTable("school", {
  id: varchar().primaryKey(),
  name: varchar().notNull(),
});

export const user = pgTable("user", {
  id: varchar().primaryKey(),
  name: varchar().notNull(),
  schoolId: varchar("school_id")
    .notNull()
    .references(() => school.id),
});

export const semester = pgTable("semester", {
  id: varchar().primaryKey(),
  name: varchar().notNull(),
});

export const module = pgTable("module", {
  id: varchar().primaryKey(),
  name: varchar().notNull(),
  code: varchar().notNull(),
  semesterId: varchar("semester_id")
    .notNull()
    .references(() => semester.id),
});

export const userModule = pgTable(
  "user_module",
  {
    userId: varchar("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
    moduleId: varchar("module_id")
      .notNull()
      .references(() => module.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.moduleId] })]
);

export const activityFolder = pgTable("activity_folder", {
  id: varchar().primaryKey(),
  name: varchar().notNull(),
  description: varchar(),
  parentId: varchar("parent_id").references((): AnyPgColumn => activityFolder.id),
  moduleId: varchar("module_id")
    .notNull()
    .references(() => module.id),
});

export const activity = pgTable("activity", {
  id: varchar().primaryKey(),
  name: varchar().notNull(),
  type: activityTypeEnum().notNull(),
  folderId: varchar("folder_id")
    .notNull()
    .references(() => activityFolder.id),
});

export const htmlActivity = pgTable("html_activity", {
  id: varchar()
    .primaryKey()
    .references(() => activity.id),
  content: varchar().notNull(),
});

export const fileActivity = pgTable("file_activity", {
  id: varchar()
    .primaryKey()
    .references(() => activity.id),
  url: varchar().notNull(),
});

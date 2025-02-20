import { pgTable, primaryKey, varchar } from "drizzle-orm/pg-core";

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
      .references(() => user.id),
    moduleId: varchar("module_id")
      .notNull()
      .references(() => module.id),
  },
  (table) => [primaryKey({ columns: [table.userId, table.moduleId] })]
);

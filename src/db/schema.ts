import { pgTable, primaryKey, varchar } from "drizzle-orm/pg-core";

export const school = pgTable("school", {
  id: varchar().primaryKey(),
  name: varchar().notNull(),
});

export const user = pgTable("user", {
  id: varchar().primaryKey(),
  name: varchar().notNull(),
  schoolId: varchar()
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
  semesterId: varchar()
    .notNull()
    .references(() => semester.id),
});

export const userModule = pgTable(
  "user_module",
  {
    userId: varchar().references(() => user.id),
    moduleId: varchar().references(() => module.id),
  },
  (table) => [primaryKey({ columns: [table.userId, table.moduleId] })]
);

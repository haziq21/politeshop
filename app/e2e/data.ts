import type { AnyActivity, Institution, Module, Semester, User } from "@politeshop/lib";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../src/lib/server/db/schema";
import { getSessionHash } from "../src/lib/server/session-hash";

const db = drizzle(process.env.DATABASE_URL!, { schema });

const id = () => crypto.randomUUID();

/** `data` is seeded into the DB for the test user; `pl` is what POLITEMall returns to match it */
export function createMocks() {
  const semesterId = id();
  const user = { id: id(), name: "Test Student" } satisfies User;
  const module = {
    id: id(),
    name: "Introduction to Testing",
    code: "IT101",
    semesterId,
  } satisfies Module & { semesterId: string };

  const reportA = {
    id: id(),
    moduleId: module.id,
    name: "Report A",
    description: "",
    dueAt: Temporal.Instant.from("2026-03-19T12:00:00Z"),
  };
  const dropboxes = [
    reportA,
    {
      id: id(),
      moduleId: module.id,
      name: "Draft C",
      description: "",
      dueAt: Temporal.Instant.from("2026-03-23T12:00:00Z"),
    },
    {
      id: id(),
      moduleId: module.id,
      name: "Too far away",
      description: "",
      dueAt: Temporal.Instant.from("2026-04-15T12:00:00Z"),
    },
    {
      id: id(),
      moduleId: module.id,
      name: "Long gone",
      description: "",
      dueAt: Temporal.Instant.from("2026-03-10T12:00:00Z"),
    },
  ];
  const quizB = {
    id: id(),
    moduleId: module.id,
    name: "Quiz B",
    description: "",
    dueAt: Temporal.Instant.from("2026-03-21T12:00:00Z"),
  };

  // Folders and topics share one sortOrder sequence: "Readings" sits between two topics
  const week1 = id();
  const readings = id();
  const week2 = id();

  return {
    data: {
      user,
      institution: { id: id(), name: "Test Polytechnic" } satisfies Institution,
      semester: { id: semesterId, name: "AY2025/2026 Semester 2" } satisfies Semester,
      module,
      dropboxes,
      quizzes: [quizB],
      submissions: [
        {
          id: id(),
          userId: user.id,
          dropboxId: reportA.id,
          submittedAt: Temporal.Instant.from("2026-03-11T09:00:00Z"),
        },
        {
          id: id(),
          userId: user.id,
          dropboxId: reportA.id,
          submittedAt: Temporal.Instant.from("2026-03-12T09:00:00Z"),
        },
      ],
      // Stored in the DB but not listed by the module, so the user is never given access to it
      hiddenActivity: { id: id(), name: "Hidden", moduleId: module.id },
    },
    pl: {
      // A sync stores these, and gives the user access to them
      activities: [
        { type: "folder", id: week1, name: "Week 1", description: "<p>Start here</p>", sortOrder: 0, parentId: null },
        { id: id(), type: "html", name: "Introduction", content: "<p>Hello</p>", sortOrder: 0, parentId: week1 },
        { type: "folder", id: readings, name: "Readings", description: "", sortOrder: 1, parentId: week1 },
        {
          id: id(),
          type: "web_embed",
          name: "Reference site",
          url: "https://example.com",
          sortOrder: 0,
          parentId: readings,
        },
        { id: id(), type: "quiz", name: quizB.name, quizId: quizB.id, sortOrder: 2, parentId: week1 },
        { type: "folder", id: week2, name: "Week 2", description: "", sortOrder: 1, parentId: null },
        { id: id(), type: "submission", name: "Report A", dropboxId: reportA.id, sortOrder: 0, parentId: week2 },
      ] satisfies AnyActivity[],
      quizzes: [quizB],
      dropboxes,
      submissions: [],
    },
  };
}

export async function seedData(
  {
    user,
    institution,
    semester,
    module,
    dropboxes,
    quizzes,
    submissions,
    hiddenActivity,
  }: ReturnType<typeof createMocks>["data"],
  credentials: { d2lSessionVal: string; d2lSecureSessionVal: string },
) {
  await db.insert(schema.organization).values(institution);
  await db.insert(schema.semester).values(semester);
  await db.insert(schema.module).values({ ...module, niceName: module.name, niceCode: module.code });
  await db
    .insert(schema.user)
    .values({ ...user, organizationId: institution.id, sessionHash: await getSessionHash(credentials) });
  await db.insert(schema.userModule).values({ userId: user.id, moduleId: module.id });
  await db.insert(schema.submissionDropbox).values(dropboxes);
  await db.insert(schema.quiz).values(quizzes);
  await db.insert(schema.userSubmission).values(submissions);
  await db.insert(schema.baseActivity).values({ ...hiddenActivity, type: "html", parentId: null, sortOrder: 9 });
  await db.insert(schema.htmlActivity).values({ id: hiddenActivity.id, content: "" });
}

export async function resetData({ user, institution, semester, module }: ReturnType<typeof createMocks>["data"]) {
  await db.delete(schema.user).where(eq(schema.user.id, user.id));
  await db.delete(schema.module).where(eq(schema.module.id, module.id));
  await db.delete(schema.semester).where(eq(schema.semester.id, semester.id));
  await db.delete(schema.organization).where(eq(schema.organization.id, institution.id));
}

import type { Institution, Module, Semester, User } from "@politeshop/lib";

// The mock clock is Wed 18 Mar 2026 10:00 UTC, so the next 14 days run to Tue 31 Mar
export function createMockData() {
  const id = () => crypto.randomUUID();
  const semesterId = id();
  const user = { id: id(), name: "Test Student" } satisfies User;
  const module = {
    id: id(),
    name: "Introduction to Testing",
    code: "IT101",
    semesterId,
  } satisfies Module & { semesterId: string };

  const dropbox = (name: string, dueAt: string) => ({
    id: id(),
    moduleId: module.id,
    name,
    dueAt: Temporal.Instant.from(dueAt),
  });
  const reportA = dropbox("Report A", "2026-03-19T12:00:00Z");

  return {
    user,
    institution: { id: id(), name: "Test Polytechnic" } satisfies Institution,
    semester: { id: semesterId, name: "AY2025/2026 Semester 2" } satisfies Semester,
    module,
    dropboxes: [
      reportA,
      dropbox("Draft C", "2026-03-23T12:00:00Z"),
      dropbox("Too far away", "2026-04-15T12:00:00Z"),
      dropbox("Long gone", "2026-03-10T12:00:00Z"),
    ],
    quizzes: [{ id: id(), moduleId: module.id, name: "Quiz B", dueAt: Temporal.Instant.from("2026-03-21T12:00:00Z") }],
    submissions: [1, 2].map((day) => ({
      id: id(),
      userId: user.id,
      dropboxId: reportA.id,
      submittedAt: Temporal.Instant.from(`2026-03-1${day}T09:00:00Z`),
    })),
  };
}

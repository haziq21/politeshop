import type { Institution, Module, Semester, User } from "@politeshop/lib";

export function createMockData() {
  const id = () => crypto.randomUUID();
  const semesterId = id();

  return {
    user: { id: id(), name: "Test Student" } satisfies User,
    institution: { id: id(), name: "Test Polytechnic" } satisfies Institution,
    semester: { id: semesterId, name: "AY2025/2026 Semester 2" } satisfies Semester,
    module: {
      id: id(),
      name: "Introduction to Testing",
      code: "IT101",
      semesterId,
    } satisfies Module & { semesterId: string },
  };
}

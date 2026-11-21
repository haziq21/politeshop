import { expect, test } from "vite-plus/test";

import { dropboxFolder, quizReadData, tableOfContents, tocTopic } from "./polite";

const topic = {
  Identifier: "10",
  TopicId: 10,
  Title: "Intro",
  Description: { Text: "", Html: "" },
  ActivityType: 1,
  TypeIdentifier: "File",
  Unread: false,
  ToolId: null,
  ToolItemId: null,
  SortOrder: 0,
  IsBroken: false,
  Url: "/content/intro.html",
};

test("tocTopic accepts a broken topic with no URL", () => {
  expect(tocTopic.safeParse({ ...topic, IsBroken: true, Url: null }).success).toBe(true);
});

test("tableOfContents parses folders nested at any depth", () => {
  const folder = { ModuleId: 1, Title: "Week 1", Description: { Text: "", Html: "" }, SortOrder: 0, Topics: [topic] };

  const toc = tableOfContents.parse({
    Modules: [{ ...folder, Modules: [{ ...folder, ModuleId: 2, Modules: [{ ...folder, ModuleId: 3, Modules: [] }] }] }],
  });

  expect(toc.Modules[0]?.Modules[0]?.Modules[0]?.ModuleId).toBe(3);
});

test("dropboxFolder turns date strings into Instants and allows null dates and availability", () => {
  const folder = {
    Id: 5,
    Name: "Report",
    CustomInstructions: { Text: "", Html: "" },
    Attachments: [],
    DueDate: "2026-03-19T12:00:00.000Z",
    SubmissionType: 0,
    CompletionType: 0,
    Availability: null,
  };

  const parsed = dropboxFolder.parse(folder);

  expect(parsed.DueDate?.toString()).toBe("2026-03-19T12:00:00Z");
  expect(parsed.Availability).toBeNull();
  expect(dropboxFolder.parse({ ...folder, DueDate: null }).DueDate).toBeNull();
});

test("quizReadData allows quizzes with no start, end or due date", () => {
  const quiz = {
    QuizId: 1,
    Name: "Quiz",
    Instructions: { Text: { Text: "", Html: "" }, IsDisplayed: false },
    Description: { Text: { Text: "", Html: "" }, IsDisplayed: false },
    StartDate: null,
    EndDate: null,
    DueDate: null,
    SortOrder: 0,
    SubmissionTimeLimit: { IsEnforced: false, ShowClock: false, TimeLimitValue: 0 },
    AttemptsAllowed: { IsUnlimited: true, NumberOfAttemptsAllowed: null },
    CalcTypeId: 0,
    Shuffle: false,
  };

  const parsed = quizReadData.parse(quiz);

  expect(parsed.StartDate).toBeNull();
  expect(parsed.EndDate).toBeNull();
  expect(parsed.DueDate).toBeNull();
  expect(quizReadData.parse({ ...quiz, StartDate: "2026-03-01T00:00:00Z" }).StartDate?.toString()).toBe(
    "2026-03-01T00:00:00Z",
  );
});

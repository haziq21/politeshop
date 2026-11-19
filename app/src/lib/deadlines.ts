export type DeadlineItem = {
  type: "submission" | "quiz";
  id: number;
  name: string;
  moduleCode: string;
  dueAt: Temporal.ZonedDateTime;
  submissionCount: number;
};

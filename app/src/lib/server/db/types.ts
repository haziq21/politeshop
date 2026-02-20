import type {
  activity,
  docEmbedActivity,
  htmlActivity,
  quizActivity,
  webEmbedActivity,
  submissionActivity,
  videoEmbedActivity,
  module,
  semester,
  activityFolder,
  organization,
  user,
  semesterBreak,
  userSubmission,
  submissionFile,
  submissionDropbox,
  quiz,
} from "./schema";

export type Organization = typeof organization.$inferInsert;
export type User = typeof user.$inferInsert;
export type Semester = typeof semester.$inferInsert;
export type Module = typeof module.$inferInsert;
export type ActivityFolder = typeof activityFolder.$inferInsert;
export type SubmissionDropbox = typeof submissionDropbox.$inferInsert;
export type UserSubmission = typeof userSubmission.$inferInsert;
export type SubmissionFile = typeof submissionFile.$inferInsert;
export type Quiz = typeof quiz.$inferInsert;
export type SemesterBreak = typeof semesterBreak.$inferInsert;

export type PartialActivity = typeof activity.$inferInsert;

type FullActivity<T extends PartialActivity["type"], TData> = PartialActivity & { type: T } & TData;
export type HTMLActivity = FullActivity<"html", typeof htmlActivity.$inferInsert>;
export type WebEmbedActivity = FullActivity<"web_embed", typeof webEmbedActivity.$inferInsert>;
export type DocEmbedActivity = FullActivity<"doc_embed", typeof docEmbedActivity.$inferInsert>;
export type VideoEmbedActivity = FullActivity<"video_embed", typeof videoEmbedActivity.$inferInsert>;
export type SubmissionActivity = FullActivity<"submission", typeof submissionActivity.$inferInsert>;
export type QuizActivity = FullActivity<"quiz", typeof quizActivity.$inferInsert>;
export type UnknownActivity = FullActivity<"unknown", {}>;

export type AnyActivity =
  | HTMLActivity
  | WebEmbedActivity
  | DocEmbedActivity
  | VideoEmbedActivity
  | SubmissionActivity
  | QuizActivity
  | UnknownActivity;

export type AnyActivityWithName = AnyActivity & { name: string };

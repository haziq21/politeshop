import type {
  baseActivity,
  docEmbedActivity,
  htmlActivity,
  quizActivity,
  webEmbedActivity,
  submissionActivity,
  videoEmbedActivity,
  module,
  semester,
  folderActivity,
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
export type SubmissionDropbox = typeof submissionDropbox.$inferInsert;
export type UserSubmission = typeof userSubmission.$inferInsert;
export type SubmissionFile = typeof submissionFile.$inferInsert;
export type Quiz = typeof quiz.$inferInsert;
export type SemesterBreak = typeof semesterBreak.$inferInsert;

export type BaseActivity = typeof baseActivity.$inferInsert;

export type FolderActivity = BaseActivity & { type: "folder" } & typeof folderActivity.$inferInsert;
export type HTMLActivity = BaseActivity & { type: "html" } & typeof htmlActivity.$inferInsert;
export type WebEmbedActivity = BaseActivity & { type: "web_embed" } & typeof webEmbedActivity.$inferInsert;
export type DocEmbedActivity = BaseActivity & { type: "doc_embed" } & typeof docEmbedActivity.$inferInsert;
export type VideoEmbedActivity = BaseActivity & { type: "video_embed" } & typeof videoEmbedActivity.$inferInsert;
export type SubmissionActivity = BaseActivity & { type: "submission" } & typeof submissionActivity.$inferInsert;
export type QuizActivity = BaseActivity & { type: "quiz" } & typeof quizActivity.$inferInsert;
export type UnknownActivity = BaseActivity & { type: "unknown" };

export type AnyActivity =
  | FolderActivity
  | HTMLActivity
  | WebEmbedActivity
  | DocEmbedActivity
  | VideoEmbedActivity
  | SubmissionActivity
  | QuizActivity
  | UnknownActivity;

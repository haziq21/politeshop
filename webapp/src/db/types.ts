import type {
  activity,
  docEmbedActivity,
  htmlActivity,
  quizActivity,
  webEmbedActivity,
  submissionActivity,
  videoEmbedActivity,
} from "./schema";

export type PartialActivity = typeof activity.$inferInsert;

type FullActivity<T extends (typeof activity.$inferInsert)["type"], TData> = PartialActivity & { type: T } & TData;
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

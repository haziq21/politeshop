CREATE TYPE "public"."activity_type" AS ENUM('html', 'web_embed', 'doc_embed', 'video_embed', 'submission', 'quiz', 'unknown');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "activity_type" NOT NULL,
	"folder_id" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_folder" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" text,
	"module_id" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_embed_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source_url" text NOT NULL,
	"preview_url" text,
	"preview_url_expiry" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "html_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"nice_name" text,
	"code" text NOT NULL,
	"nice_code" text,
	"text_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nice_text_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"semester_id" text NOT NULL,
	"image_icon_url" text
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"banner_image_url" text,
	"academic_calendar_link" text
);
--> statement-breakpoint
CREATE TABLE "quiz" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"due_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quiz_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"quiz_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semester" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semester_break" (
	"organization_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"dropbox_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_dropbox" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"due_at" timestamp with time zone,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "submission_file" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"size" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"session_hash" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activity_access" (
	"user_id" text NOT NULL,
	"activity_id" text NOT NULL,
	CONSTRAINT "user_activity_access_user_id_activity_id_pk" PRIMARY KEY("user_id","activity_id")
);
--> statement-breakpoint
CREATE TABLE "user_folder_access" (
	"user_id" text NOT NULL,
	"folder_id" text NOT NULL,
	CONSTRAINT "user_folder_access_user_id_folder_id_pk" PRIMARY KEY("user_id","folder_id")
);
--> statement-breakpoint
CREATE TABLE "user_module" (
	"user_id" text NOT NULL,
	"module_id" text NOT NULL,
	CONSTRAINT "user_module_user_id_module_id_pk" PRIMARY KEY("user_id","module_id")
);
--> statement-breakpoint
CREATE TABLE "user_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dropbox_id" text NOT NULL,
	"submitted_at" timestamp with time zone,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "video_embed_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source_url" text NOT NULL,
	"source_url_expiry" timestamp with time zone,
	"thumbnail_url" text,
	"thumbnail_url_expiry" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "web_embed_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_folder_id_activity_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."activity_folder"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_folder" ADD CONSTRAINT "activity_folder_parent_id_activity_folder_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."activity_folder"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_folder" ADD CONSTRAINT "activity_folder_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "doc_embed_activity" ADD CONSTRAINT "doc_embed_activity_id_activity_id_fk" FOREIGN KEY ("id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "html_activity" ADD CONSTRAINT "html_activity_id_activity_id_fk" FOREIGN KEY ("id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "module" ADD CONSTRAINT "module_semester_id_semester_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semester"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quiz_activity" ADD CONSTRAINT "quiz_activity_id_activity_id_fk" FOREIGN KEY ("id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quiz_activity" ADD CONSTRAINT "quiz_activity_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "semester_break" ADD CONSTRAINT "semester_break_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "submission_activity" ADD CONSTRAINT "submission_activity_id_activity_id_fk" FOREIGN KEY ("id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "submission_activity" ADD CONSTRAINT "submission_activity_dropbox_id_submission_dropbox_id_fk" FOREIGN KEY ("dropbox_id") REFERENCES "public"."submission_dropbox"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "submission_dropbox" ADD CONSTRAINT "submission_dropbox_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "submission_file" ADD CONSTRAINT "submission_file_submission_id_user_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."user_submission"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_access" ADD CONSTRAINT "user_activity_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_activity_access" ADD CONSTRAINT "user_activity_access_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_folder_access" ADD CONSTRAINT "user_folder_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_folder_access" ADD CONSTRAINT "user_folder_access_folder_id_activity_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."activity_folder"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_module" ADD CONSTRAINT "user_module_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_module" ADD CONSTRAINT "user_module_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_submission" ADD CONSTRAINT "user_submission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_submission" ADD CONSTRAINT "user_submission_dropbox_id_submission_dropbox_id_fk" FOREIGN KEY ("dropbox_id") REFERENCES "public"."submission_dropbox"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "video_embed_activity" ADD CONSTRAINT "video_embed_activity_id_activity_id_fk" FOREIGN KEY ("id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "web_embed_activity" ADD CONSTRAINT "web_embed_activity_id_activity_id_fk" FOREIGN KEY ("id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "user_session_hash_index" ON "user" USING btree ("session_hash");
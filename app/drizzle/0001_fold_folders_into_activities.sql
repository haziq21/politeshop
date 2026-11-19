-- activity becomes base_activity, the table every other activity table extends
ALTER TABLE "activity" RENAME TO "base_activity";--> statement-breakpoint
ALTER INDEX "activity_pkey" RENAME TO "base_activity_pkey";--> statement-breakpoint
ALTER TABLE "doc_embed_activity" RENAME CONSTRAINT "doc_embed_activity_id_activity_id_fk" TO "doc_embed_activity_id_base_activity_id_fk";--> statement-breakpoint
ALTER TABLE "html_activity" RENAME CONSTRAINT "html_activity_id_activity_id_fk" TO "html_activity_id_base_activity_id_fk";--> statement-breakpoint
ALTER TABLE "quiz_activity" RENAME CONSTRAINT "quiz_activity_id_activity_id_fk" TO "quiz_activity_id_base_activity_id_fk";--> statement-breakpoint
ALTER TABLE "submission_activity" RENAME CONSTRAINT "submission_activity_id_activity_id_fk" TO "submission_activity_id_base_activity_id_fk";--> statement-breakpoint
ALTER TABLE "video_embed_activity" RENAME CONSTRAINT "video_embed_activity_id_activity_id_fk" TO "video_embed_activity_id_base_activity_id_fk";--> statement-breakpoint
ALTER TABLE "web_embed_activity" RENAME CONSTRAINT "web_embed_activity_id_activity_id_fk" TO "web_embed_activity_id_base_activity_id_fk";--> statement-breakpoint
ALTER TABLE "user_activity_access" RENAME CONSTRAINT "user_activity_access_activity_id_activity_id_fk" TO "user_activity_access_activity_id_base_activity_id_fk";--> statement-breakpoint
-- Postgres can't use a value added by ALTER TYPE ... ADD VALUE in the transaction that added it,
-- and the backfill below inserts 'folder' activities, so the enum is recreated instead.
CREATE TYPE "public"."activity_type_new" AS ENUM('folder', 'html', 'web_embed', 'doc_embed', 'video_embed', 'submission', 'quiz', 'unknown');--> statement-breakpoint
ALTER TABLE "base_activity" ALTER COLUMN "type" TYPE "public"."activity_type_new" USING "type"::text::"public"."activity_type_new";--> statement-breakpoint
DROP TYPE "public"."activity_type";--> statement-breakpoint
ALTER TYPE "public"."activity_type_new" RENAME TO "activity_type";--> statement-breakpoint
CREATE TABLE "folder_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "base_activity" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "base_activity" ADD COLUMN "module_id" text;--> statement-breakpoint
ALTER TABLE "base_activity" ADD COLUMN "parent_id" text;--> statement-breakpoint
-- Backfill existing activities: module and parent come from their folder
UPDATE "base_activity" SET "module_id" = f."module_id", "parent_id" = f."id" FROM "activity_folder" f WHERE f."id" = "base_activity"."folder_id";--> statement-breakpoint
ALTER TABLE "base_activity" DROP COLUMN "folder_id";--> statement-breakpoint
-- Backfill names: submission and quiz activities take their assessment's name, which is what the app showed
UPDATE "base_activity" SET "name" = h."name" FROM "html_activity" h WHERE h."id" = "base_activity"."id";--> statement-breakpoint
UPDATE "base_activity" SET "name" = w."name" FROM "web_embed_activity" w WHERE w."id" = "base_activity"."id";--> statement-breakpoint
UPDATE "base_activity" SET "name" = d."name" FROM "doc_embed_activity" d WHERE d."id" = "base_activity"."id";--> statement-breakpoint
UPDATE "base_activity" SET "name" = v."name" FROM "video_embed_activity" v WHERE v."id" = "base_activity"."id";--> statement-breakpoint
UPDATE "base_activity" SET "name" = b."name" FROM "submission_activity" s INNER JOIN "submission_dropbox" b ON b."id" = s."dropbox_id" WHERE s."id" = "base_activity"."id";--> statement-breakpoint
UPDATE "base_activity" SET "name" = q."name" FROM "quiz_activity" qa INNER JOIN "quiz" q ON q."id" = qa."quiz_id" WHERE qa."id" = "base_activity"."id";--> statement-breakpoint
-- Unknown activities never had a name; the next sync replaces this
UPDATE "base_activity" SET "name" = 'Untitled' WHERE "name" IS NULL;--> statement-breakpoint
-- Folders become activities
INSERT INTO "base_activity" ("id", "type", "name", "module_id", "sort_order") SELECT "id", 'folder', "name", "module_id", "sort_order" FROM "activity_folder";--> statement-breakpoint
INSERT INTO "folder_activity" ("id", "description") SELECT "id", coalesce("description", '') FROM "activity_folder";--> statement-breakpoint
UPDATE "base_activity" SET "parent_id" = f."parent_id" FROM "activity_folder" f WHERE f."id" = "base_activity"."id";--> statement-breakpoint
INSERT INTO "user_activity_access" ("user_id", "activity_id") SELECT "user_id", "folder_id" FROM "user_folder_access" ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "base_activity" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "base_activity" ALTER COLUMN "module_id" SET NOT NULL;--> statement-breakpoint
DROP TABLE "user_folder_access";--> statement-breakpoint
DROP TABLE "activity_folder";--> statement-breakpoint
ALTER TABLE "folder_activity" ADD CONSTRAINT "folder_activity_id_base_activity_id_fk" FOREIGN KEY ("id") REFERENCES "public"."base_activity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "base_activity" ADD CONSTRAINT "base_activity_module_id_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."module"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "base_activity" ADD CONSTRAINT "base_activity_parent_id_base_activity_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."base_activity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "doc_embed_activity" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "html_activity" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "video_embed_activity" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "web_embed_activity" DROP COLUMN "name";

CREATE TABLE "avatar_deletions" (
	"key" text PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_avatar_key_check";--> statement-breakpoint
CREATE INDEX "avatar_deletions_person_id_idx" ON "avatar_deletions" USING btree ("person_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_key_check" CHECK ("profiles"."avatar_key" IS NULL OR "profiles"."avatar_key" ~ '^avatars/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif)$');
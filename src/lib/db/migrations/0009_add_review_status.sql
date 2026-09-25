ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "review_status" text DEFAULT 'approved' NOT NULL;
--> statement-breakpoint
UPDATE "places" SET "review_status" = CASE WHEN "is_active" THEN 'approved' ELSE 'pending' END WHERE "review_status" = 'approved';
ALTER TABLE "project_requests" ADD COLUMN IF NOT EXISTS "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "project_requests" ADD COLUMN IF NOT EXISTS "map_image_url" text;
--> statement-breakpoint
UPDATE "project_requests"
SET "cover_image_url" = "image_urls"[1],
		"image_urls" = CASE
			WHEN cardinality("image_urls") > 1 THEN "image_urls"[2:cardinality("image_urls")]
			ELSE '{}'::text[]
		END
WHERE "cover_image_url" IS NULL AND cardinality("image_urls") > 0;
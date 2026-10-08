ALTER TABLE "place_metrics" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "place_metrics" ADD COLUMN "category_id" text;--> statement-breakpoint
UPDATE "place_metrics"
SET "province" = "places"."province",
    "category_id" = "places"."category_id"
FROM "places"
WHERE "places"."id" = "place_metrics"."place_id";--> statement-breakpoint
ALTER TABLE "place_metrics" ALTER COLUMN "province" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "place_metrics" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "place_metrics_province_idx" ON "place_metrics" USING btree ("province");--> statement-breakpoint
CREATE INDEX "place_metrics_category_idx" ON "place_metrics" USING btree ("category_id");

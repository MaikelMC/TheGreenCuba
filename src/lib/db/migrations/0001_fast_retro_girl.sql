ALTER TABLE "places" ALTER COLUMN "boost_expires_at" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "emoji" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "schedule" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "offer_text" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "offer_expiry" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "menu" jsonb;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "rating" double precision;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "price_label" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "ai_tags" text[];
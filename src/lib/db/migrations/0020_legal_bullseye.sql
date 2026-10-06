CREATE TABLE "analytics_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"day" text NOT NULL,
	"province" text DEFAULT '' NOT NULL,
	"municipality" text DEFAULT '' NOT NULL,
	"category_id" text DEFAULT '' NOT NULL,
	"searches" integer DEFAULT 0 NOT NULL,
	"successful_searches" integer DEFAULT 0 NOT NULL,
	"no_result_searches" integer DEFAULT 0 NOT NULL,
	"business_views" integer DEFAULT 0 NOT NULL,
	"business_impressions" integer DEFAULT 0 NOT NULL,
	"business_actions" integer DEFAULT 0 NOT NULL,
	"new_users" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"new_businesses" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_daily_dim_unique" UNIQUE("day","province","municipality","category_id")
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text,
	"session_id" text,
	"business_id" text,
	"search_query" text,
	"category_id" text,
	"province" text,
	"municipality" text,
	"result_count" integer,
	"source" text,
	"medium" text,
	"campaign" text,
	"referrer" text,
	"metadata" jsonb,
	"dedupe_key" text,
	CONSTRAINT "analytics_events_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE INDEX "analytics_daily_day_idx" ON "analytics_daily" USING btree ("day");--> statement-breakpoint
CREATE INDEX "analytics_events_type_created_idx" ON "analytics_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_created_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_business_created_idx" ON "analytics_events" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_user_created_idx" ON "analytics_events" USING btree ("user_id","created_at");
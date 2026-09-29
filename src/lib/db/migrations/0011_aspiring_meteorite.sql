CREATE TABLE "project_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"contact" text NOT NULL,
	"phones" text[] NOT NULL,
	"social_links" text[] NOT NULL,
	"provinces" text[] NOT NULL,
	"venue_name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text NOT NULL,
	"offers" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_requests" ADD CONSTRAINT "project_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_requests_user_idx" ON "project_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_requests_status_idx" ON "project_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_requests_created_idx" ON "project_requests" USING btree ("created_at");
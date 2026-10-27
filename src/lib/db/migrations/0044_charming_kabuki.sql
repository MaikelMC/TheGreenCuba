CREATE TABLE "business_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"place_id" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "business_invitations" ADD CONSTRAINT "business_invitations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_invitations" ADD CONSTRAINT "business_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_invitations_place_idx" ON "business_invitations" USING btree ("place_id");
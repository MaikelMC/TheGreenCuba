CREATE TABLE "contacts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"opted_in_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
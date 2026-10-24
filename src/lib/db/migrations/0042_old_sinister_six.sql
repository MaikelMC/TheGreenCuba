ALTER TABLE "asistente_codigos" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "telegram_vinculos" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "business_owners" ADD COLUMN "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "asistente_codigos" ADD CONSTRAINT "asistente_codigos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_vinculos" ADD CONSTRAINT "telegram_vinculos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
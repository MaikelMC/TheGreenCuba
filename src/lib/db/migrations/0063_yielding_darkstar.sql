CREATE TABLE "notas_negocio" (
	"place_id" text PRIMARY KEY NOT NULL,
	"nota" text DEFAULT '' NOT NULL,
	"actualizado_por" text,
	"actualizado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notas_negocio" ADD CONSTRAINT "notas_negocio_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_negocio" ADD CONSTRAINT "notas_negocio_actualizado_por_users_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
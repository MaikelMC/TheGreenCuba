CREATE TABLE "reservas_dias" (
	"id" text PRIMARY KEY NOT NULL,
	"place_id" text NOT NULL,
	"fecha" text NOT NULL,
	"personas" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reservas_dias_clave_unique" UNIQUE("place_id","fecha")
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "aforo_diario_personas" integer;--> statement-breakpoint
ALTER TABLE "reservas_dias" ADD CONSTRAINT "reservas_dias_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;
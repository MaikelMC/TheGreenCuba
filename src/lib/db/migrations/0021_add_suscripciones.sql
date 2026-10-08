CREATE TABLE "suscripciones" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"plan" text DEFAULT 'gratis' NOT NULL,
	"estado" text DEFAULT 'activa' NOT NULL,
	"trial_hasta" timestamp,
	"vence_en" timestamp,
	"descuento_pct" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "suscripciones_negocio_unique" UNIQUE("negocio_id"),
	CONSTRAINT "suscripciones_descuento_check" CHECK ("suscripciones"."descuento_pct" is null or ("suscripciones"."descuento_pct" >= 0 and "suscripciones"."descuento_pct" <= 100))
);
--> statement-breakpoint
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;

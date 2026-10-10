CREATE TABLE "ranking_mensual" (
	"id" text PRIMARY KEY NOT NULL,
	"periodo" text NOT NULL,
	"negocio_id" text NOT NULL,
	"categoria" text NOT NULL,
	"municipio" text NOT NULL,
	"posicion" integer NOT NULL,
	"visitas" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ranking_mensual_puesto_unique" UNIQUE("periodo","categoria","municipio","negocio_id"),
	CONSTRAINT "ranking_mensual_posicion_check" CHECK ("ranking_mensual"."posicion" >= 1 and "ranking_mensual"."posicion" <= 3)
);
--> statement-breakpoint
ALTER TABLE "ranking_mensual" ADD CONSTRAINT "ranking_mensual_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ranking_mensual_grupo_idx" ON "ranking_mensual" USING btree ("periodo","categoria","municipio");
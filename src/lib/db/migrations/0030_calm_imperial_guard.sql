CREATE TABLE "publicaciones" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"texto" text NOT NULL,
	"imagen_url" text,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"semana" text NOT NULL,
	"enlace" text,
	"publicada_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "publicaciones_estado_check" CHECK ("publicaciones"."estado" in ('borrador', 'lista', 'publicada')),
	CONSTRAINT "publicaciones_enlace_check" CHECK ("publicaciones"."estado" <> 'publicada' or "publicaciones"."enlace" is not null)
);
--> statement-breakpoint
ALTER TABLE "publicaciones" ADD CONSTRAINT "publicaciones_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "publicaciones_negocio_semana_idx" ON "publicaciones" USING btree ("negocio_id","semana");
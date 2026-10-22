CREATE TABLE "novedades" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"texto" text,
	"producto_id" text,
	"producto_nombre" text,
	"imagen_url" text,
	"precio_antes" text,
	"precio_ahora" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "novedades_tipo_check" CHECK ("novedades"."tipo" in ('producto_nuevo', 'cambio_precio', 'actualizacion'))
);
--> statement-breakpoint
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "novedades_negocio_fecha_idx" ON "novedades" USING btree ("negocio_id","created_at");
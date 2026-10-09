CREATE TABLE "ofertas" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"producto_id" text NOT NULL,
	"titulo" text NOT NULL,
	"descripcion" text,
	"precio_oferta" text,
	"descuento_pct" integer,
	"inicia" timestamp NOT NULL,
	"termina" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ofertas_rango_check" CHECK ("ofertas"."termina" > "ofertas"."inicia"),
	CONSTRAINT "ofertas_rebaja_check" CHECK (num_nonnulls("ofertas"."precio_oferta", "ofertas"."descuento_pct") = 1),
	CONSTRAINT "ofertas_pct_check" CHECK ("ofertas"."descuento_pct" is null or ("ofertas"."descuento_pct" >= 1 and "ofertas"."descuento_pct" <= 99))
);
--> statement-breakpoint
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ofertas_negocio_termina_idx" ON "ofertas" USING btree ("negocio_id","termina");
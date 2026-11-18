CREATE TABLE "productos" (
	"id" text PRIMARY KEY NOT NULL,
	"place_id" text NOT NULL,
	"orden" integer NOT NULL,
	"categoria" text,
	"nombre" text NOT NULL,
	"descripcion" text DEFAULT '' NOT NULL,
	"imagen" text,
	"tag" text,
	"precio_texto" text DEFAULT '' NOT NULL,
	"precio" numeric(12, 2),
	"moneda" text NOT NULL,
	"tipo_precio" text DEFAULT 'fijo' NOT NULL,
	"disponibilidad" text DEFAULT 'disponible' NOT NULL,
	"agotado_hasta" timestamp with time zone,
	"oculto" boolean DEFAULT false NOT NULL,
	"destacado" boolean DEFAULT false NOT NULL,
	"stock" integer,
	"duracion_min" integer,
	"external_id" text,
	"importacion_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "productos_precio_check" CHECK ("productos"."precio" is null or "productos"."precio" >= 0),
	CONSTRAINT "productos_tipo_precio_check" CHECK ("productos"."tipo_precio" in ('fijo', 'desde', 'consultar')),
	CONSTRAINT "productos_disponibilidad_check" CHECK ("productos"."disponibilidad" in ('disponible', 'agotado')),
	CONSTRAINT "productos_stock_check" CHECK ("productos"."stock" is null or "productos"."stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "revisar_motivos" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "productos_place_orden_idx" ON "productos" USING btree ("place_id","orden");--> statement-breakpoint
CREATE INDEX "productos_place_categoria_idx" ON "productos" USING btree ("place_id","categoria");--> statement-breakpoint
CREATE INDEX "productos_place_importacion_idx" ON "productos" USING btree ("place_id","importacion_id");
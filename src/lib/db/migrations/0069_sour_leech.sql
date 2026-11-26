CREATE TABLE "facturas" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"negocio_nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"pack_id" text,
	"plan_clave" text,
	"titulo" text NOT NULL,
	"conceptos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nota" text,
	"precio_usd" real NOT NULL,
	"precio_original_usd" real,
	"descuento_pct" integer,
	"oferta_2x1" boolean DEFAULT false NOT NULL,
	"tasa_cup" real,
	"estado" text DEFAULT 'enviada' NOT NULL,
	"creado_por" text,
	"pago_id" text,
	"enviada_en" timestamp DEFAULT now() NOT NULL,
	"aceptada_en" timestamp,
	"pagada_en" timestamp,
	"cancelada_en" timestamp,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_pack_id_packs_medida_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs_medida"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facturas_negocio_idx" ON "facturas" USING btree ("negocio_id","creado_en");--> statement-breakpoint
CREATE INDEX "facturas_estado_idx" ON "facturas" USING btree ("estado","creado_en");--> statement-breakpoint
CREATE INDEX "facturas_pack_idx" ON "facturas" USING btree ("pack_id");
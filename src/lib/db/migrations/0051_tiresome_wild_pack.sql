CREATE TABLE "packs_medida" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"estado" text DEFAULT 'solicitado' NOT NULL,
	"servicios_solicitados" text[] DEFAULT '{}' NOT NULL,
	"servicios" text[] DEFAULT '{}' NOT NULL,
	"funciones" text[] DEFAULT '{}' NOT NULL,
	"precio_usd" real,
	"precio_sugerido_usd" real,
	"oferta_2x1" boolean DEFAULT false NOT NULL,
	"nota_cliente" text,
	"nota_interna" text,
	"creado_por" text,
	"enviado_en" timestamp,
	"pagado_en" timestamp,
	"vence_en" timestamp,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recordatorios_pago" DROP CONSTRAINT "recordatorios_pago_unico";--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "pack_medida_id" text;--> statement-breakpoint
ALTER TABLE "recordatorios_pago" ADD COLUMN "concepto" text DEFAULT 'plan' NOT NULL;--> statement-breakpoint
ALTER TABLE "packs_medida" ADD CONSTRAINT "packs_medida_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs_medida" ADD CONSTRAINT "packs_medida_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "packs_medida_negocio_idx" ON "packs_medida" USING btree ("negocio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "packs_medida_pendiente_idx" ON "packs_medida" USING btree ("negocio_id") WHERE "packs_medida"."estado" in ('solicitado', 'borrador', 'enviado');--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pack_medida_id_packs_medida_id_fk" FOREIGN KEY ("pack_medida_id") REFERENCES "public"."packs_medida"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordatorios_pago" ADD CONSTRAINT "recordatorios_pago_unico" UNIQUE("negocio_id","fecha_pago","tipo","concepto");
CREATE TABLE "recordatorios_pago" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"fecha_pago" timestamp NOT NULL,
	"tipo" text NOT NULL,
	"push_enviado_en" timestamp,
	"email_enviado_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recordatorios_pago_unico" UNIQUE("negocio_id","fecha_pago","tipo")
);
--> statement-breakpoint
ALTER TABLE "recordatorios_pago" ADD CONSTRAINT "recordatorios_pago_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recordatorios_pago_negocio_idx" ON "recordatorios_pago" USING btree ("negocio_id");
CREATE TABLE "reembolsos_facturas" (
	"id" text PRIMARY KEY NOT NULL,
	"factura_id" text NOT NULL,
	"pago_id" text,
	"monto_centavos" integer NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"motivo" text NOT NULL,
	"registrado_por" text,
	"registrado_por_nombre" text NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reembolsos_facturas" ADD CONSTRAINT "reembolsos_facturas_factura_id_facturas_id_fk" FOREIGN KEY ("factura_id") REFERENCES "public"."facturas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reembolsos_facturas" ADD CONSTRAINT "reembolsos_facturas_pago_id_pagos_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reembolsos_facturas" ADD CONSTRAINT "reembolsos_facturas_registrado_por_users_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reembolsos_facturas_factura_unique" ON "reembolsos_facturas" USING btree ("factura_id");--> statement-breakpoint
CREATE INDEX "reembolsos_facturas_fecha_idx" ON "reembolsos_facturas" USING btree ("creado_en");
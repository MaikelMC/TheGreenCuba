CREATE TABLE "pagos" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"metodo" text DEFAULT 'qvapay' NOT NULL,
	"tipo" text NOT NULL,
	"clave" text NOT NULL,
	"monto_centavos" integer NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"qvapay_id" text,
	"pagado_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pagos_negocio_fecha_idx" ON "pagos" USING btree ("negocio_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pagos_qvapay_unique" ON "pagos" USING btree ("qvapay_id");
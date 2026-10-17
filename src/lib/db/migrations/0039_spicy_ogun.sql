CREATE TABLE "pedidos" (
	"id" text PRIMARY KEY NOT NULL,
	"place_id" text NOT NULL,
	"lineas" jsonb NOT NULL,
	"direccion" text,
	"estado" text DEFAULT 'nuevo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pedidos_negocio_fecha_idx" ON "pedidos" USING btree ("place_id","created_at");
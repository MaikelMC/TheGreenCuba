CREATE TABLE "diagnosticos" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"datos" jsonb NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negocios_eliminados" (
	"place_id" text PRIMARY KEY NOT NULL,
	"eliminado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "fuera_de_horario" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "diagnosticos_tipo_idx" ON "diagnosticos" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "diagnosticos_creado_en_idx" ON "diagnosticos" USING btree ("creado_en");--> statement-breakpoint
CREATE INDEX "places_provincia_updated_idx" ON "places" USING btree ("province","updated_at");
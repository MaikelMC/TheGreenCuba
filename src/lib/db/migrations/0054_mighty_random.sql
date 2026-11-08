CREATE TABLE "diagnosticos" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"datos" jsonb NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "diagnosticos_tipo_idx" ON "diagnosticos" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "diagnosticos_creado_en_idx" ON "diagnosticos" USING btree ("creado_en");
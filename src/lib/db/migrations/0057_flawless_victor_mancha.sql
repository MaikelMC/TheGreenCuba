ALTER TABLE "pedidos" ADD COLUMN "codigo" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "pedidos" ALTER COLUMN "codigo" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "programado_para" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "revisar_hora" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "revisar_motivo" text;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "avisado_en" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_place_codigo_idx" ON "pedidos" USING btree ("place_id","codigo");
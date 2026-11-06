ALTER TABLE "places" ADD COLUMN "tasa_usd_cup" double precision;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "tasa_actualizada_en" timestamp;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "tasa_redondeo" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "tasa_activa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "tasa_usada" double precision;
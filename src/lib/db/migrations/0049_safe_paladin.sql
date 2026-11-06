ALTER TABLE "pedidos" ADD COLUMN "modo_entrega" text;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "zona_nombre" text;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "costo_envio" double precision;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "costo_envio_moneda" text;
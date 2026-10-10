ALTER TABLE "publicaciones" ADD COLUMN "orden" integer;--> statement-breakpoint
UPDATE "publicaciones" AS p SET "orden" = s.rn - 1 FROM (SELECT "id", row_number() OVER (PARTITION BY "negocio_id", "semana" ORDER BY "created_at", "id") AS rn FROM "publicaciones") AS s WHERE p."id" = s."id";--> statement-breakpoint
ALTER TABLE "publicaciones" ALTER COLUMN "orden" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "publicaciones" ADD CONSTRAINT "publicaciones_negocio_semana_orden_unique" UNIQUE("negocio_id","semana","orden");

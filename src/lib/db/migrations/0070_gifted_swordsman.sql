CREATE SEQUENCE "public"."facturas_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "facturas" ALTER COLUMN "estado" SET DEFAULT 'pendiente';--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "nota_autor" text;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "precio_separado_usd" real;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "expira_en" timestamp;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "metodo_pago" text;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "aviso_pago_en" timestamp;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "numero_factura" integer;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_numero_factura_unique" UNIQUE("numero_factura");--> statement-breakpoint
UPDATE "facturas" SET "estado" = 'pendiente' WHERE "estado" = 'enviada';--> statement-breakpoint
UPDATE "facturas" SET "expira_en" = "creado_en" + interval '7 days' WHERE "expira_en" IS NULL AND "estado" = 'pendiente';--> statement-breakpoint
WITH ordenadas AS (
  SELECT "id", row_number() OVER (ORDER BY "pagada_en" NULLS LAST, "creado_en") AS n
  FROM "facturas"
  WHERE "estado" = 'pagada' AND "numero_factura" IS NULL
)
UPDATE "facturas" f SET "numero_factura" = o.n FROM ordenadas o WHERE f."id" = o."id";--> statement-breakpoint
SELECT setval(
  'facturas_numero_seq',
  GREATEST((SELECT COALESCE(MAX("numero_factura"), 0) FROM "facturas"), 1),
  (SELECT COALESCE(MAX("numero_factura"), 0) FROM "facturas") > 0
);
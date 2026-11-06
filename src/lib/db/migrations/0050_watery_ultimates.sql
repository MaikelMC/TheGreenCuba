ALTER TABLE "places" ADD COLUMN "tipo_confirmado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "places"
SET
  tipo_negocio = CASE tipo_negocio
    WHEN 'cafeteria_restaurante' THEN 'cafeteria'
    WHEN 'tienda_mipyme'         THEN 'mipyme'
    WHEN 'servicios'             THEN 'otro'
    ELSE tipo_negocio
  END,
  tipo_confirmado = (tipo_negocio = 'comida_domicilio')
WHERE tipo_negocio IS NOT NULL;
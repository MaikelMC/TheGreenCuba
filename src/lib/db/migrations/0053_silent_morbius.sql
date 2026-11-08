CREATE TABLE "negocios_eliminados" (
	"place_id" text PRIMARY KEY NOT NULL,
	"eliminado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "places_provincia_updated_idx" ON "places" USING btree ("province","updated_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION fn_sync_negocios_eliminados()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  era_publico boolean := false;
  es_publico  boolean := false;
BEGIN
  era_publico := COALESCE(OLD.is_active, false)
                 AND COALESCE(OLD.review_status = 'approved', false);
  IF TG_OP = 'UPDATE' THEN
    es_publico := COALESCE(NEW.is_active, false)
                  AND COALESCE(NEW.review_status = 'approved', false);
  END IF;

  IF era_publico AND NOT es_publico THEN
    INSERT INTO negocios_eliminados (place_id, eliminado_en)
    VALUES (OLD.id, now())
    ON CONFLICT (place_id) DO UPDATE SET eliminado_en = now();
  ELSIF TG_OP = 'UPDATE' AND NOT era_publico AND es_publico THEN
    DELETE FROM negocios_eliminados WHERE place_id = NEW.id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_sync_negocios_eliminados ON places;
--> statement-breakpoint
CREATE TRIGGER trg_sync_negocios_eliminados
AFTER UPDATE OR DELETE ON places
FOR EACH ROW
EXECUTE FUNCTION fn_sync_negocios_eliminados();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS negocios_eliminados_fecha_idx
  ON negocios_eliminados (eliminado_en);

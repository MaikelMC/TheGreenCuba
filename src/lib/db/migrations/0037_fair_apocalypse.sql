ALTER TABLE "suscripciones" ADD COLUMN "modulos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "place_overrides" ADD COLUMN "modulos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
/* El plan pasó de la escalera gratis/básico/pro a packs con módulos. Las dos
   columnas son `text` con el enum solo en TypeScript, así que no hay DDL que
   las cambie: lo que hay son **filas viejas** con la palabra «basico», y esa
   clave ya no existe en el catálogo —leerla reventaría al resolver permisos—.
   Se renombra al pack equivalente y se deja el resto intacto: `vence_en` y
   `trial_hasta` no se tocan, así que un negocio pagado sigue pagado. */
UPDATE "suscripciones" SET "plan" = 'esencial' WHERE "plan" = 'basico';--> statement-breakpoint
UPDATE "place_overrides" SET "plan" = 'esencial' WHERE "plan" = 'basico';

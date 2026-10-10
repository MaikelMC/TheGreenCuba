ALTER TABLE "places" ADD COLUMN "acepta_reservas" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "tipo_reserva" text DEFAULT 'mesa' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "aforo_max_personas" integer;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "plantilla_reserva" text;
ALTER TABLE "places" ADD COLUMN "tipo_negocio" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "modulos_activos" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "atributos" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "color_marca" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "portada_encuadre" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "acciones" jsonb;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "horario" jsonb;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "cerrado_mensaje" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "entrega" jsonb;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "como_comprar" jsonb;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "como_atiende" jsonb;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "especial_dia" jsonb;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "catalogo_titulo" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "menu_categorias" jsonb;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "existencias_modo" text DEFAULT 'disponible' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "catalogo_actualizado_en" timestamp;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "catalogo_fuente" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "resena_destacada_id" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "plantilla_pedido" text;--> statement-breakpoint
ALTER TABLE "place_images" ADD COLUMN "seccion" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "respuesta" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "respondida_en" timestamp;
CREATE TABLE "avisos_seguidores" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"semana" text NOT NULL,
	"titulo" text NOT NULL,
	"enviados" integer DEFAULT 0 NOT NULL,
	"fallidos" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seguidores" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"canal" text NOT NULL,
	"destino" text NOT NULL,
	"consentimiento_en" timestamp NOT NULL,
	"baja_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seguidores_clave_unique" UNIQUE("negocio_id","canal","destino")
);
--> statement-breakpoint
ALTER TABLE "avisos_seguidores" ADD CONSTRAINT "avisos_seguidores_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguidores" ADD CONSTRAINT "seguidores_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "avisos_seguidores_negocio_semana_idx" ON "avisos_seguidores" USING btree ("negocio_id","semana");--> statement-breakpoint
CREATE INDEX "seguidores_negocio_idx" ON "seguidores" USING btree ("negocio_id","baja_en");--> statement-breakpoint
CREATE INDEX "seguidores_destino_idx" ON "seguidores" USING btree ("canal","destino");
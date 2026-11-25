CREATE TABLE "prospectos" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"provincia" text NOT NULL,
	"origen" text DEFAULT 'visita_propia' NOT NULL,
	"origen_detalle" text,
	"etapa" text DEFAULT 'contactado' NOT NULL,
	"proximo_paso" text DEFAULT '' NOT NULL,
	"proximo_paso_en" timestamp,
	"notas" text DEFAULT '' NOT NULL,
	"admin_responsable_id" text,
	"negocio_id" text,
	"etapa_cambiada_en" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prospectos" ADD CONSTRAINT "prospectos_admin_responsable_id_users_id_fk" FOREIGN KEY ("admin_responsable_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospectos" ADD CONSTRAINT "prospectos_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospectos_etapa_idx" ON "prospectos" USING btree ("etapa");--> statement-breakpoint
CREATE INDEX "prospectos_responsable_idx" ON "prospectos" USING btree ("admin_responsable_id");--> statement-breakpoint
CREATE INDEX "prospectos_negocio_idx" ON "prospectos" USING btree ("negocio_id");--> statement-breakpoint
CREATE INDEX "prospectos_actualizado_idx" ON "prospectos" USING btree ("updated_at");
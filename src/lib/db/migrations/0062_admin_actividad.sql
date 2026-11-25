CREATE TABLE "admin_actividad" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text,
	"admin_nombre" text NOT NULL,
	"accion" text NOT NULL,
	"objeto_tipo" text NOT NULL,
	"objeto_id" text,
	"resumen" text NOT NULL,
	"datos" jsonb,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_actividad" ADD CONSTRAINT "admin_actividad_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actividad_fecha_idx" ON "admin_actividad" USING btree ("creado_en");--> statement-breakpoint
CREATE INDEX "admin_actividad_admin_idx" ON "admin_actividad" USING btree ("admin_id","creado_en");--> statement-breakpoint
CREATE INDEX "admin_actividad_objeto_idx" ON "admin_actividad" USING btree ("objeto_tipo","objeto_id");
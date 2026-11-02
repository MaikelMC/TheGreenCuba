CREATE TABLE "seguimientos" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"negocio_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seguimientos_clave_unique" UNIQUE("usuario_id","negocio_id")
);
--> statement-breakpoint
ALTER TABLE "seguimientos" ADD CONSTRAINT "seguimientos_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seguimientos" ADD CONSTRAINT "seguimientos_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seguimientos_negocio_idx" ON "seguimientos" USING btree ("negocio_id");--> statement-breakpoint
CREATE INDEX "seguimientos_usuario_idx" ON "seguimientos" USING btree ("usuario_id");
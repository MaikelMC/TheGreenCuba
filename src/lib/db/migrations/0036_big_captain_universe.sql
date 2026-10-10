CREATE TABLE "asistente_codigos" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"codigo" text NOT NULL,
	"expira_en" timestamp NOT NULL,
	"usado_en" timestamp,
	"usado_por" text,
	"creado" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asistente_codigos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "asistente_log" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"mensaje" text,
	"accion" text NOT NULL,
	"antes" jsonb,
	"despues" jsonb,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"via" text NOT NULL,
	"pendiente" boolean DEFAULT false NOT NULL,
	"deshecho_en" timestamp,
	"ts" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_updates" (
	"update_id" bigint PRIMARY KEY NOT NULL,
	"creado" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_vinculos" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"rol" text DEFAULT 'dueno' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_vinculos_chat_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
ALTER TABLE "asistente_codigos" ADD CONSTRAINT "asistente_codigos_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistente_log" ADD CONSTRAINT "asistente_log_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_vinculos" ADD CONSTRAINT "telegram_vinculos_negocio_id_places_id_fk" FOREIGN KEY ("negocio_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asistente_codigos_negocio_idx" ON "asistente_codigos" USING btree ("negocio_id");--> statement-breakpoint
CREATE INDEX "asistente_log_negocio_ts_idx" ON "asistente_log" USING btree ("negocio_id","ts");--> statement-breakpoint
CREATE INDEX "asistente_log_chat_ts_idx" ON "asistente_log" USING btree ("chat_id","ts");--> statement-breakpoint
CREATE INDEX "telegram_updates_creado_idx" ON "telegram_updates" USING btree ("creado");--> statement-breakpoint
CREATE INDEX "telegram_vinculos_negocio_idx" ON "telegram_vinculos" USING btree ("negocio_id");
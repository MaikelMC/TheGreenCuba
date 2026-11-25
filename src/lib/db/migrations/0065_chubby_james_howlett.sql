CREATE TABLE "afiliado_liquidaciones" (
	"id" text PRIMARY KEY NOT NULL,
	"afiliado_id" text NOT NULL,
	"mes" text NOT NULL,
	"monto_usd_centavos" integer NOT NULL,
	"tasa_usd_cup" integer NOT NULL,
	"monto_cup_centavos" integer NOT NULL,
	"pagado_por" text,
	"pagado_en" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "afiliado_liquidaciones_unico" UNIQUE("afiliado_id","mes")
);
--> statement-breakpoint
ALTER TABLE "afiliado_liquidaciones" ADD CONSTRAINT "afiliado_liquidaciones_afiliado_id_users_id_fk" FOREIGN KEY ("afiliado_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afiliado_liquidaciones" ADD CONSTRAINT "afiliado_liquidaciones_pagado_por_users_id_fk" FOREIGN KEY ("pagado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "afiliado_liquidaciones_mes_idx" ON "afiliado_liquidaciones" USING btree ("mes");
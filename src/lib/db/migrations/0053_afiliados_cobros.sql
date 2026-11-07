CREATE TABLE "afiliado_cobros" (
	"id" text PRIMARY KEY NOT NULL,
	"afiliado_id" text NOT NULL,
	"monto_cup_centavos" integer NOT NULL,
	"monto_usd_centavos" integer NOT NULL,
	"tasa_usd_cup" integer NOT NULL,
	"metodo" text NOT NULL,
	"destino" text NOT NULL,
	"estado" text DEFAULT 'pedido' NOT NULL,
	"resuelto_por" text,
	"nota" text,
	"resuelto_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "afiliado_notas" (
	"id" text PRIMARY KEY NOT NULL,
	"afiliado_id" text NOT NULL,
	"autor_id" text,
	"texto" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "afiliado_premios" (
	"id" text PRIMARY KEY NOT NULL,
	"afiliado_id" text NOT NULL,
	"mes" text NOT NULL,
	"tipo" text NOT NULL,
	"entregado_por" text,
	"entregado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "afiliado_premios_unico" UNIQUE("afiliado_id","mes","tipo")
);
--> statement-breakpoint
ALTER TABLE "afiliado_cobros" ADD CONSTRAINT "afiliado_cobros_afiliado_id_users_id_fk" FOREIGN KEY ("afiliado_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afiliado_cobros" ADD CONSTRAINT "afiliado_cobros_resuelto_por_users_id_fk" FOREIGN KEY ("resuelto_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afiliado_notas" ADD CONSTRAINT "afiliado_notas_afiliado_id_users_id_fk" FOREIGN KEY ("afiliado_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afiliado_notas" ADD CONSTRAINT "afiliado_notas_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afiliado_premios" ADD CONSTRAINT "afiliado_premios_afiliado_id_users_id_fk" FOREIGN KEY ("afiliado_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "afiliado_premios" ADD CONSTRAINT "afiliado_premios_entregado_por_users_id_fk" FOREIGN KEY ("entregado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "afiliado_cobros_afiliado_idx" ON "afiliado_cobros" USING btree ("afiliado_id","created_at");--> statement-breakpoint
CREATE INDEX "afiliado_cobros_estado_idx" ON "afiliado_cobros" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "afiliado_notas_afiliado_idx" ON "afiliado_notas" USING btree ("afiliado_id","created_at");
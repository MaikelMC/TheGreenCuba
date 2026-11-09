CREATE TABLE "clientes_frecuentes" (
	"id" text PRIMARY KEY NOT NULL,
	"place_id" text NOT NULL,
	"telefono" text NOT NULL,
	"nombre" text,
	"sellos" integer DEFAULT 0 NOT NULL,
	"sellos_totales" integer DEFAULT 0 NOT NULL,
	"ciclo" integer DEFAULT 1 NOT NULL,
	"token" text NOT NULL,
	"origen" text DEFAULT 'manual' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos_sellos" (
	"id" text PRIMARY KEY NOT NULL,
	"cliente_id" text NOT NULL,
	"place_id" text NOT NULL,
	"tipo" text NOT NULL,
	"cantidad" integer NOT NULL,
	"pedido_id" text,
	"meta_indice" integer,
	"ciclo" integer NOT NULL,
	"usuario_id" text,
	"nota" text,
	"anulado" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "fidelidad" jsonb;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "telefono_cliente" text;--> statement-breakpoint
ALTER TABLE "clientes_frecuentes" ADD CONSTRAINT "clientes_frecuentes_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_sellos" ADD CONSTRAINT "movimientos_sellos_cliente_id_clientes_frecuentes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes_frecuentes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_sellos" ADD CONSTRAINT "movimientos_sellos_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_sellos" ADD CONSTRAINT "movimientos_sellos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_sellos" ADD CONSTRAINT "movimientos_sellos_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_frecuentes_place_telefono_idx" ON "clientes_frecuentes" USING btree ("place_id","telefono");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_frecuentes_token_idx" ON "clientes_frecuentes" USING btree ("token");--> statement-breakpoint
CREATE INDEX "clientes_frecuentes_place_actividad_idx" ON "clientes_frecuentes" USING btree ("place_id","actualizado_en");--> statement-breakpoint
CREATE INDEX "movimientos_sellos_cliente_fecha_idx" ON "movimientos_sellos" USING btree ("cliente_id","creado_en");--> statement-breakpoint
CREATE INDEX "movimientos_sellos_place_fecha_idx" ON "movimientos_sellos" USING btree ("place_id","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "movimientos_sellos_pedido_activo_idx" ON "movimientos_sellos" USING btree ("pedido_id") WHERE "movimientos_sellos"."tipo" = 'sello' and "movimientos_sellos"."anulado" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "movimientos_sellos_canje_idx" ON "movimientos_sellos" USING btree ("cliente_id","ciclo","meta_indice") WHERE "movimientos_sellos"."tipo" = 'canje';--> statement-breakpoint
CREATE INDEX "pedidos_place_telefono_idx" ON "pedidos" USING btree ("place_id","telefono_cliente");
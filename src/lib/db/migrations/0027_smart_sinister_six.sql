CREATE TABLE "eventos_diarios" (
	"id" text PRIMARY KEY NOT NULL,
	"negocio_id" text NOT NULL,
	"fecha" text NOT NULL,
	"tipo" text NOT NULL,
	"dimension" text DEFAULT '' NOT NULL,
	"conteo" integer DEFAULT 0 NOT NULL,
	"unicos" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_diarios_clave_unique" UNIQUE("negocio_id","fecha","tipo","dimension")
);
--> statement-breakpoint
CREATE TABLE "eventos_unicos" (
	"negocio_id" text NOT NULL,
	"fecha" text NOT NULL,
	"tipo" text NOT NULL,
	"dimension" text DEFAULT '' NOT NULL,
	"visitante" text NOT NULL,
	CONSTRAINT "eventos_unicos_negocio_id_fecha_tipo_dimension_visitante_pk" PRIMARY KEY("negocio_id","fecha","tipo","dimension","visitante")
);
--> statement-breakpoint
CREATE INDEX "eventos_diarios_negocio_fecha_idx" ON "eventos_diarios" USING btree ("negocio_id","fecha");
CREATE TABLE "catalogo_planes" (
	"id" text PRIMARY KEY NOT NULL,
	"datos" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

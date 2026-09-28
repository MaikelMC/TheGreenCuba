/**
 * Aplica la migración 0010 (place_metrics, support_tickets, admin_broadcasts
 * y sender_name en notifications) de forma idempotente.
 *
 * `drizzle-kit push` se queda colgado desde esta red hacia Neon; el script
 * conecta con el mismo driver que usa la app y ejecuta el DDL con guardas
 * `IF NOT EXISTS` / DO-blocks, así que se puede correr dos veces sin daño.
 *
 * Uso: `node --env-file-if-exists=.env scripts/apply-migration-0010.mjs`
 */

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  connect_timeout: 30,
  idle_timeout: 10,
});

const DDL = `
CREATE TABLE IF NOT EXISTS "admin_broadcasts" (
  "id" text PRIMARY KEY NOT NULL,
  "sender_id" text,
  "sender_name" text,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "recipient_count" integer DEFAULT 0 NOT NULL,
  "meta" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "place_metrics" (
  "id" text PRIMARY KEY NOT NULL,
  "place_id" text NOT NULL,
  "views" integer DEFAULT 0 NOT NULL,
  "map_clicks" integer DEFAULT 0 NOT NULL,
  "route_requests" integer DEFAULT 0 NOT NULL,
  "ai_matches" integer DEFAULT 0 NOT NULL,
  "saves" integer DEFAULT 0 NOT NULL,
  "shares" integer DEFAULT 0 NOT NULL,
  "meta" jsonb,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "place_metrics_place_id_unique" UNIQUE("place_id")
);

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text,
  "email" text NOT NULL,
  "user_snapshot" jsonb,
  "subject" text NOT NULL,
  "message" text NOT NULL,
  "page_path" text,
  "meta" jsonb,
  "status" text DEFAULT 'open' NOT NULL,
  "admin_reply" text,
  "replied_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "admin_broadcasts" ADD CONSTRAINT "admin_broadcasts_sender_id_users_id_fk"
    FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "place_metrics" ADD CONSTRAINT "place_metrics_place_id_places_id_fk"
    FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "place_metrics_views_idx" ON "place_metrics" USING btree ("views");
CREATE INDEX IF NOT EXISTS "support_tickets_status_created_idx" ON "support_tickets" USING btree ("status","created_at");

-- Columna nueva de notifications (remitente de los avisos de administración).
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "sender_name" text;
`;

async function main() {
  console.log("Aplicando migración 0010…");
  await sql.unsafe(DDL);
  console.log("OK: tablas place_metrics, support_tickets, admin_broadcasts y columna notifications.sender_name verificadas.");

  // Comprobación legible de lo que quedó en la base.
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('place_metrics', 'support_tickets', 'admin_broadcasts', 'notifications')
    ORDER BY table_name
  `;
  console.log("Tablas presentes:", tables.map((t) => t.table_name).join(", "));

  const col = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'sender_name'
  `;
  console.log("notifications.sender_name:", col.length > 0 ? "presente" : "AUSENTE");
}

main()
  .then(() => sql.end())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("FALLO:", error.message);
    await sql.end().catch(() => {});
    process.exit(1);
  });

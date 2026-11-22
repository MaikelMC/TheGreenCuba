import pg from "pg";

/* Postgres estándar (VPS) o Neon con URL directa. Sin interpolaciones: estas
   migraciones son SQL fijo, así que la etiqueta solo une el texto. */
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está definida.");
const url = new URL(process.env.DATABASE_URL);
const conSsl = url.searchParams.get("sslmode") === "require";
url.searchParams.delete("sslmode");
url.searchParams.delete("channel_binding");
const pool = new pg.Pool({
  connectionString: url.toString(),
  ssl: conSsl ? { rejectUnauthorized: false } : undefined,
  max: 1,
  allowExitOnIdle: true,
});
const sql = async (partes) => (await pool.query(partes.join(""))).rows;

async function main() {
  await sql`ALTER TABLE "project_requests" ADD COLUMN IF NOT EXISTS "image_urls" text[] DEFAULT '{}'::text[] NOT NULL`;
  await sql`ALTER TABLE "project_requests" ADD COLUMN IF NOT EXISTS "offer_image_url" text`;
  await sql`ALTER TABLE "project_requests" ADD COLUMN IF NOT EXISTS "cover_image_url" text`;
  await sql`ALTER TABLE "project_requests" ADD COLUMN IF NOT EXISTS "map_image_url" text`;
  await sql`
    UPDATE "project_requests"
    SET "cover_image_url" = "image_urls"[1],
        "image_urls" = CASE
          WHEN cardinality("image_urls") > 1 THEN "image_urls"[2:cardinality("image_urls")]
          ELSE '{}'::text[]
        END
    WHERE "cover_image_url" IS NULL AND cardinality("image_urls") > 0
  `;

  const columns = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_requests'
      AND column_name IN ('image_urls', 'offer_image_url', 'cover_image_url', 'map_image_url')
  `;
  const present = new Set(columns.map((row) => row.column_name));
  const required = ["image_urls", "offer_image_url", "cover_image_url", "map_image_url"];
  const missing = required.filter((column) => !present.has(column));
  if (missing.length > 0) throw new Error(`Faltan columnas después de la migración: ${missing.join(", ")}`);
  console.log("OK: columnas de medios de proyectos presentes y fotos antiguas migradas a portada/galería.");
}

main().catch((error) => {
  console.error("FALLO:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

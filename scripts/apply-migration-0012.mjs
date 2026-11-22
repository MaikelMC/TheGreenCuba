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
  await sql`
    ALTER TABLE "project_requests"
    ADD COLUMN IF NOT EXISTS "image_urls" text[] DEFAULT '{}'::text[] NOT NULL
  `;

  const columns = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_requests'
      AND column_name = 'image_urls'
  `;

  if (columns.length === 0) throw new Error("project_requests.image_urls no quedó creada.");
  console.log("OK: project_requests.image_urls está disponible.");
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("FALLO:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
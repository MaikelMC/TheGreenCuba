import { neon, neonConfig } from "@neondatabase/serverless";

neonConfig.fetchFunction = async (input, init) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      const delay = [500, 1500, 4000][attempt];
      if (delay === undefined || init?.signal?.aborted) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const sql = neon(process.env.DATABASE_URL);

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
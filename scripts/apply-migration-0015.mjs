import { neon, neonConfig } from "@neondatabase/serverless";

neonConfig.fetchFunction = async (input, init) => {
  const retryDelays = [500, 1500, 4000, 8000, 12000];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      const code = error?.cause?.code ?? error?.code;
      const retryable = ["UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(code);
      const delay = retryDelays[attempt];
      if (!retryable || delay === undefined || init?.signal?.aborted) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está definida.");
const sql = neon(process.env.DATABASE_URL);

async function main() {
  await sql`ALTER TABLE "project_requests" ADD COLUMN IF NOT EXISTS "offer_packages" jsonb DEFAULT '[]'::jsonb NOT NULL`;

  const columns = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_requests'
      AND column_name = 'offer_packages'
  `;
  if (columns.length === 0) throw new Error("project_requests.offer_packages no quedó creada.");
  console.log("OK: project_requests.offer_packages está disponible.");
}

main().catch((error) => {
  console.error("FALLO:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
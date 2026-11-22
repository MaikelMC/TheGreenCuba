/* Inspección del esquema neon_auth en la base del túnel. Solo lectura. */
import pg from "pg";

const { Client } = pg;

/* El túnel escucha en ::1; 127.0.0.1 rechaza la conexión. */
const destino = new URL(process.env.DATABASE_URL);
if (process.env.TUNEL_HOST) {
  destino.hostname = process.env.TUNEL_HOST.includes(":")
    ? `[${process.env.TUNEL_HOST}]`
    : process.env.TUNEL_HOST;
}
destino.searchParams.delete("sslmode");

const cliente = new Client({
  connectionString: destino.toString(),
  keepAlive: true,
  connectionTimeoutMillis: 15000,
  query_timeout: 20000,
});

const q = async (sql, params) => (await cliente.query(sql, params)).rows;

await cliente.connect();

try {
  const tablas = await q(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'neon_auth'
    ORDER BY table_name
  `);
  console.log("TABLAS neon_auth:", tablas.map((t) => t.table_name).join(", "));

  const columnas = new Map();
  for (const { table_name } of tablas) {
    const cols = await q(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'neon_auth' AND table_name = $1
       ORDER BY ordinal_position`,
      [table_name],
    );
    columnas.set(table_name, cols);
    console.log(`\n--- ${table_name} ---`);
    for (const c of cols) {
      console.log(
        `  ${c.column_name} ${c.data_type}${c.is_nullable === "NO" ? " NOT NULL" : ""}${c.column_default ? ` default ${c.column_default}` : ""}`,
      );
    }
  }

  const indices = await q(`
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'neon_auth'
    ORDER BY tablename, indexname
  `);
  console.log("\n--- ÍNDICES ---");
  for (const i of indices) console.log(`  ${i.indexdef}`);

  const constraints = await q(`
    SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE connamespace = 'neon_auth'::regnamespace
    ORDER BY conrelid::regclass::text, conname
  `);
  console.log("\n--- CONSTRAINTS ---");
  for (const c of constraints) console.log(`  ${c.tabla} ${c.conname}: ${c.def}`);

  const col = (tabla, ...candidatos) => {
    const lista = columnas.get(tabla) ?? [];
    return lista.find((c) =>
      candidatos.some((n) => c.column_name.toLowerCase() === n.toLowerCase()),
    )?.column_name;
  };

  const provider = col("account", "providerId", "provider_id");
  const password = col("account", "password");
  if (provider) {
    const cuentas = await q(`
      SELECT "${provider}" AS provider, count(*)::int AS n,
             count(*) FILTER (WHERE "${password}" IS NOT NULL)::int AS con_password,
             min(length("${password}"))::int AS largo_min,
             max(length("${password}"))::int AS largo_max,
             min(left("${password}", 3)) AS prefijo
      FROM neon_auth."account"
      GROUP BY 1 ORDER BY n DESC
    `);
    console.log("\n--- account por provider ---");
    for (const c of cuentas) console.log("  ", c);
  }

  if (password) {
    const muestras = await q(`
      SELECT left("${password}", 46) AS muestra, length("${password}")::int AS largo
      FROM neon_auth."account"
      WHERE "${password}" IS NOT NULL
      LIMIT 3
    `);
    console.log("\n--- muestras de hash (recortadas) ---");
    for (const m of muestras) console.log("  ", m);
  }

  const verificado = col("user", "emailVerified", "email_verified");
  const usuarios = await q(`
    SELECT count(*)::int AS n
           ${verificado ? `, count(*) FILTER (WHERE "${verificado}")::int AS verificados` : ""}
    FROM neon_auth."user"
  `);
  console.log("\n--- usuarios ---", usuarios[0]);

  const sesiones = await q(`SELECT count(*)::int AS n FROM neon_auth.session`);
  console.log("--- sesiones ---", sesiones[0]);

  const mapeo = await q(`
    SELECT count(*)::int AS perfiles,
           count(*) FILTER (WHERE auth_user_id IS NOT NULL)::int AS con_auth_id
    FROM public.users
  `);
  console.log("--- public.users ---", mapeo[0]);

  const huerfanos = await q(`
    SELECT count(*)::int AS n FROM public.users u
    LEFT JOIN neon_auth."user" a ON a.id::text = u.auth_user_id
    WHERE u.auth_user_id IS NOT NULL AND a.id IS NULL
  `);
  console.log("--- perfiles sin fila en neon_auth.user ---", huerfanos[0]);

  const passkeys = await q(`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_name ILIKE '%passkey%'
  `);
  console.log("--- tablas passkey ---", passkeys);

  const migraciones = await q(`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_name ILIKE '%migration%' OR table_name ILIKE '%drizzle%'
  `);
  console.log("--- tablas de migraciones ---", migraciones);
} finally {
  await cliente.end();
}

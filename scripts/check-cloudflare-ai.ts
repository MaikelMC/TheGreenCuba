/**
 * Comprobación de la integración con Cloudflare Workers AI.
 *
 *   npx tsx scripts/check-cloudflare-ai.ts
 *
 * Golpea la API de verdad: si el token caduca, si Cloudflare retira un modelo
 * o si cambia la forma de la respuesta, esto falla y lo dice. Es lo único que
 * detecta esos tres casos — el compilador no los ve.
 *
 * Necesita CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN en el entorno (o en
 * .env). No imprime el token en ningún momento.
 */
import {
  CF_MODELS,
  EMBEDDING_DIM,
  generateEmbedding,
  generateResponse,
  generateResponseStream,
  toPgVector,
  type Message,
} from "../src/lib/ai/cloudflare";
import { explicitRadiusM } from "../src/lib/ai/query-radius";

function check(label: string, ok: boolean, detail = ""): boolean {
  console.log(`${ok ? "ok  " : "FALLA"} ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function main(): Promise<void> {
  let failures = 0;
  const fail = (label: string, ok: boolean, detail = "") => {
    if (!check(label, ok, detail)) failures += 1;
  };

  // 0. Sin red ni credenciales: el parser de radio de `searchPlacesByQuery`.
  //    Va primero a propósito para que siga corriendo cuando el token falta o
  //    caducó — es la pieza que más fácil se rompe en silencio (un `km` sin
  //    multiplicar no falla: filtra por 1 metro y parece que «no hay
  //    resultados»).
  const radii: [string, number | null][] = [
    ["restaurantes a menos de 1 km", 1000],
    ["algo a menos de 500 m", 500],
    ["a menos de 3,5 km", 3500],
    ["a menos de 5000 km", 100_000], // topado: a esa distancia no filtra nada
    ["a menos de 0 km", null], // no es un radio
    ["café tranquilo cerca de mí", null], // la cercanía la da la ubicación
  ];
  for (const [text, expected] of radii) {
    const got = explicitRadiusM(text);
    fail(`radio de "${text}"`, got === expected, `= ${got} (esperado ${expected})`);
  }

  // 1. Embeddings. Lo que se comprueba de verdad es la dimensión: si bge-m3
  //    cambiara de tamaño, la columna vector(1024) de Postgres empezaría a
  //    rechazar los INSERT y el fallo aparecería a kilómetros de aquí.
  const started = Date.now();
  const vector = await generateEmbedding("café tranquilo con wifi cerca de mí");
  fail(
    "generateEmbedding devuelve el vector",
    Array.isArray(vector) && vector.length === EMBEDDING_DIM,
    `dim=${vector.length} (esperado ${EMBEDDING_DIM}) en ${Date.now() - started} ms`,
  );
  fail(
    "el vector es numérico",
    vector.every((n) => Number.isFinite(n)),
  );

  // 2. Literal de pgvector: `'[...]'::vector`.
  const literal = toPgVector(vector);
  fail(
    "toPgVector produce un literal de pgvector",
    literal.startsWith("[") && literal.endsWith("]") && !literal.includes(" "),
    `${literal.slice(0, 24)}…`,
  );

  // 3. Lote: una llamada para varios textos.
  const many = await generateEmbedding(["playa", "restaurante"]);
  fail(
    "generateEmbedding acepta lotes",
    many.length === 2 && many[0]!.length === EMBEDDING_DIM,
  );

  // 4. Generación sin streaming.
  const messages: Message[] = [
    { role: "system", content: "Responde en una sola frase corta." },
    { role: "user", content: "Dime un lugar típico de Santiago de Cuba." },
  ];
  const answer = await generateResponse(messages, { maxTokens: 1500 });
  fail(
    "generateResponse devuelve texto",
    answer.trim().length > 0,
    `${answer.trim().length} caracteres`,
  );

  // 5. Streaming: lo que importa es que lleguen trozos de texto, no uno solo ni
  //    ninguno. Sin esto, el streaming puede estar devolviendo el SSE crudo y
  //    el usuario vería `data: {...}` en pantalla.
  const stream = await generateResponseStream(messages, { maxTokens: 1500 });
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let chunks = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const piece = decoder.decode(value, { stream: true });
    if (piece) {
      chunks += 1;
      text += piece;
    }
  }
  fail(
    "generateResponseStream entrega texto plano",
    text.trim().length > 0 && !text.includes("data:"),
    `${chunks} trozos, ${text.trim().length} caracteres`,
  );

  console.log(
    `\nmodelos: ${CF_MODELS.embeddings} | ${CF_MODELS.generation} | ${CF_MODELS.generationFallback}`,
  );
  console.log(failures === 0 ? "TODO OK" : `${failures} comprobación(es) fallaron`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Error no controlado:", error instanceof Error ? error.message : error);
  process.exit(1);
});

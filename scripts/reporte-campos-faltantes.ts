import { db, schema } from "@/lib/db";

/**
 * Reporte de solo lectura: fichas cuyo texto libre sugiere un dato estructurado
 * que la ficha no puede pintar porque la columna está vacía.
 *
 * No escribe nada y no intenta extraer el dato: un parser heurístico convertiría
 * «a veces hacemos envíos» en «tiene reparto configurado», que es una afirmación
 * que el negocio no hizo. El reporte solo señala dónde mirar; lo completa el
 * dueño desde el panel o la administración.
 *
 * Uso:
 *   npx tsx --env-file-if-exists=.env scripts/reporte-campos-faltantes.ts
 */

const SENALES = [
  {
    campo: "energia_respaldo",
    patron: /\b(planta eléctrica|planta electrica|inversor|generador)\b/i,
    falta: (p: Fila) => p.energiaRespaldo === null || p.energiaRespaldo === "ninguna",
  },
  {
    campo: "entrega",
    patron: /\b(domicilio|reparto|env[ií]o|entrega a domicilio)\b/i,
    falta: (p: Fila) => p.entrega === null,
  },
  {
    campo: "payment_methods (Zelle)",
    patron: /\bzelle\b/i,
    falta: (p: Fila) => !p.paymentMethods?.some((m) => /zelle/i.test(m)),
  },
  {
    campo: "payment_methods (efectivo)",
    patron: /\b(efectivo|efectivo en mano)\b/i,
    falta: (p: Fila) => !p.paymentMethods?.some((m) => /efectivo/i.test(m)),
  },
] as const;

interface Fila {
  name: string;
  description: string | null;
  shortDescription: string | null;
  energiaRespaldo: string | null;
  entrega: unknown;
  paymentMethods: string[] | null;
}

async function main() {
  const places = await db
    .select({
      name: schema.places.name,
      description: schema.places.description,
      shortDescription: schema.places.shortDescription,
      energiaRespaldo: schema.places.energiaRespaldo,
      entrega: schema.places.entrega,
      paymentMethods: schema.places.paymentMethods,
    })
    .from(schema.places);

  let hallazgos = 0;

  for (const place of places) {
    const texto = `${place.description ?? ""} ${place.shortDescription ?? ""}`;
    if (!texto.trim()) continue;

    for (const senal of SENALES) {
      if (!senal.patron.test(texto) || !senal.falta(place)) continue;
      hallazgos += 1;
      console.log(`· ${place.name} — menciona «${senal.patron.source}» y no tiene ${senal.campo}.`);
    }
  }

  console.log(`\n${hallazgos} hallazgos en ${places.length} fichas. Nada se ha modificado.`);
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});

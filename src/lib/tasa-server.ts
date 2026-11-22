/**
 * Lógica de servidor para la tasa del día.
 *
 * «Precios mixtos» es para todos los negocios, sin plan: `tasa_activa` es el
 * interruptor que el dueño enciende en Ajustes.
 *
 * `configTasaDe` — lo que viaja a la carta pública: solo devuelve algo si los
 * precios mixtos están activos y hay tasa del USD.
 *
 * `actualizarTasa` — lo que llama la ruta de API y el bot de Telegram.
 * Valida y guarda; el permiso sobre el negocio lo comprueba quien llama.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { invalidarCatalogo } from "@/lib/db/queries";
import { REDONDEOS_PERMITIDOS, type ConfigTasa, type Redondeo } from "@/lib/precios";
import { trackEvent } from "@/lib/analytics/events";

/** Lo que leen la carta pública y los componentes del panel. */
export async function configTasaDe(negocioId: string): Promise<ConfigTasa | null> {
  const [row] = await db
    .select({
      tasaUsdCup: places.tasaUsdCup,
      tasaRedondeo: places.tasaRedondeo,
      tasaActiva: places.tasaActiva,
      tasaActualizadaEn: places.tasaActualizadaEn,
      tasaEurCup: places.tasaEurCup,
      tasaMlcCup: places.tasaMlcCup,
      transferenciaPct: places.transferenciaPct,
    })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  if (!row || !row.tasaActiva || !row.tasaUsdCup) return null;

  return {
    tasaUsdCup: row.tasaUsdCup,
    tasaRedondeo: row.tasaRedondeo,
    tasaActualizadaEn: row.tasaActualizadaEn,
    tasaEurCup: row.tasaEurCup,
    tasaMlcCup: row.tasaMlcCup,
    transferenciaPct: row.transferenciaPct,
  };
}

export type ActualizarTasaInput = {
  tasa?: number;
  redondeo?: number;
  activa?: boolean;
  /** `null` borra la tasa (la ficha deja de ofrecer esa moneda). */
  tasaEur?: number | null;
  tasaMlc?: number | null;
  transferenciaPct?: number | null;
};

/** Una tasa válida: número entre 0 y 100.000, sin incluir los extremos. */
function tasaValida(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n < 100_000;
}

export type ActualizarTasaResult =
  | { success: true }
  | { success: false; error: string; code: "validacion" };

/**
 * Escribe la tasa del día para un negocio.
 *
 * Lo llaman la ruta de API (`PATCH /api/places/[id]/tasa`) y el handler del
 * bot de Telegram. La validación vive aquí y no en las dos llamadas por
 * separado.
 *
 * `origen` va al evento de analítica para saber de dónde viene cada cambio.
 */
export async function actualizarTasa(
  negocioId: string,
  input: ActualizarTasaInput,
  origen: "panel" | "telegram" = "panel",
): Promise<ActualizarTasaResult> {
  const valores: Partial<typeof places.$inferInsert> = {};

  if (input.tasa !== undefined) {
    if (typeof input.tasa !== "number" || !tasaValida(input.tasa)) {
      return {
        success: false,
        code: "validacion",
        error: "La tasa debe ser un número entre 1 y 99.999.",
      };
    }
    valores.tasaUsdCup = input.tasa;
    valores.tasaActualizadaEn = new Date();
  }

  if (input.redondeo !== undefined) {
    if (!(REDONDEOS_PERMITIDOS as readonly number[]).includes(input.redondeo)) {
      return {
        success: false,
        code: "validacion",
        error: `El redondeo debe ser uno de: ${REDONDEOS_PERMITIDOS.join(", ")}.`,
      };
    }
    valores.tasaRedondeo = input.redondeo as Redondeo;
  }

  if (input.activa !== undefined) {
    valores.tasaActiva = input.activa;
  }

  for (const [clave, columna, nombre] of [
    ["tasaEur", "tasaEurCup", "del EUR"],
    ["tasaMlc", "tasaMlcCup", "de la USD Clásica"],
  ] as const) {
    const v = input[clave];
    if (v === undefined) continue;
    if (v !== null && !tasaValida(v)) {
      return {
        success: false,
        code: "validacion",
        error: `La tasa ${nombre} debe ser un número entre 1 y 99.999.`,
      };
    }
    valores[columna] = v;
  }

  if (input.transferenciaPct !== undefined) {
    const p = input.transferenciaPct;
    if (p !== null && !(Number.isFinite(p) && p >= 0 && p <= 100)) {
      return {
        success: false,
        code: "validacion",
        error: "El recargo por transferencia debe estar entre 0 y 100 %.",
      };
    }
    valores.transferenciaPct = p;
  }

  if (Object.keys(valores).length === 0) return { success: true };

  await db.update(places).set(valores).where(eq(places.id, negocioId));

  /* La tasa viaja en `UserPlace` (`toUserPlace`), así que la sirven la ficha, la
     carta, el panel y el mapa desde la caché del catálogo. Sin esto, un cambio
     de tasa no se veía hasta que caducaba la entrada (5 min en producción). */
  invalidarCatalogo();

  trackEvent({
    type: "tasa_actualizada",
    businessId: negocioId,
    source: origen,
    metadata: {
      tasa: input.tasa,
      redondeo: input.redondeo,
      activa: input.activa,
    },
  });

  return { success: true };
}

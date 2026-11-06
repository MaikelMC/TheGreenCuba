/**
 * Lógica de servidor para la tasa del día.
 *
 * `configTasaDe` — lo que viaja a la carta pública: solo devuelve algo si la
 * tasa está activa y el negocio tiene el plan.
 *
 * `actualizarTasa` — lo que llama la ruta de API y el bot de Telegram.
 * Comprueba el permiso, valida y guarda.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { puede } from "@/lib/plans-server";
import { REDONDEOS_PERMITIDOS, type ConfigTasa, type Redondeo } from "@/lib/precios";
import { trackEvent } from "@/lib/analytics/events";

/** Lo que leen la carta pública y los componentes del panel. */
export async function configTasaDe(negocioId: string): Promise<ConfigTasa | null> {
  if (!(await puede(negocioId, "tasa_del_dia"))) return null;

  const [row] = await db
    .select({
      tasaUsdCup: places.tasaUsdCup,
      tasaRedondeo: places.tasaRedondeo,
      tasaActiva: places.tasaActiva,
      tasaActualizadaEn: places.tasaActualizadaEn,
    })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  if (!row || !row.tasaActiva || !row.tasaUsdCup) return null;

  return {
    tasaUsdCup: row.tasaUsdCup,
    tasaRedondeo: row.tasaRedondeo,
    tasaActualizadaEn: row.tasaActualizadaEn,
  };
}

export type ActualizarTasaInput = {
  tasa?: number;
  redondeo?: number;
  activa?: boolean;
};

export type ActualizarTasaResult =
  | { success: true }
  | { success: false; error: string; code: "plan" | "validacion" };

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
  if (!(await puede(negocioId, "tasa_del_dia"))) {
    return { success: false, code: "plan", error: "La tasa del día entra con el módulo Menú Pro." };
  }

  const valores: Partial<typeof places.$inferInsert> = {};

  if (input.tasa !== undefined) {
    if (
      typeof input.tasa !== "number" ||
      !Number.isFinite(input.tasa) ||
      input.tasa <= 0 ||
      input.tasa >= 100_000
    ) {
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

  if (Object.keys(valores).length === 0) return { success: true };

  await db.update(places).set(valores).where(eq(places.id, negocioId));

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

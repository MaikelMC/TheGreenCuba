/**
 * Demanda contra oferta (`§20`).
 *
 * La pregunta que responde es de producto: «¿qué busca la gente que no existe
 * o existe poco?». Por eso el ratio se calcula contra `max(oferta, 1)` y no
 * contra la oferta real: **cero negocios y cien búsquedas es el caso más
 * interesante**, y una división por cero lo perdería.
 *
 * El score es el ratio normalizado a 0-100 con un techo de 50 búsquedas por
 * negocio —por encima de eso no cambia la decisión—. Los umbrales de nivel
 * (alta/media/baja) son de negocio, no estadísticos.
 *
 * Puro y sin dependencias: se prueba sin base (`src/lib/analytics/demand.test.ts`).
 */

export type DemandLevel = "alta" | "media" | "baja";

export interface DemandScore {
  demand: number;
  offer: number;
  ratio: number;
  score: number;
  level: DemandLevel;
}

/** Techo del ratio para el score: 50 búsquedas por negocio ya es 100. */
const SCORE_CEILING = 50;

export function scoreDemand(demand: number, offer: number): DemandScore {
  const ratio = demand / Math.max(offer, 1);
  const score = Math.min(100, Math.round((ratio / SCORE_CEILING) * 100));
  const level: DemandLevel =
    ratio > 20 ? "alta" : ratio > 5 ? "media" : "baja";
  return {
    demand,
    offer,
    ratio: Number(ratio.toFixed(1)),
    score,
    level,
  };
}

/** Etiqueta del nivel, para tablas y CSV. */
export const DEMAND_LEVEL_LABELS: Record<DemandLevel, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

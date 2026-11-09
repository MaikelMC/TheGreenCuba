/**
 * Lógica de servidor para el horario de cocina.
 *
 * `actualizarPausa` escribe la pausa en `entrega.pausa` e invalida la caché
 * de la carta y la ficha. Es el único punto que toca la pausa, así que el
 * panel y el bot de Telegram pasan por aquí y no hay dos caminos que olviden
 * invalidar.
 *
 * `estadoCocinaDeNegocio` lee el estado actual para el panel y el bot.
 */

import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { CATALOG_TAG } from "@/lib/db/queries";
import { estadoCocina, type EstadoCocina } from "@/lib/ficha/cocina";
import type { EntregaConfig } from "@/lib/ficha/entrega";
import type { Horario } from "@/lib/ficha/horario";

/** Lee la entrega y el horario del negocio en una sola consulta. */
async function leerCocina(negocioId: string): Promise<{
  entrega: EntregaConfig | null;
  horario: Horario | null;
} | null> {
  const [row] = await db
    .select({ entrega: places.entrega, horario: places.horario })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);
  if (!row) return null;
  return {
    entrega: (row.entrega as EntregaConfig | null) ?? null,
    horario: (row.horario as Horario | null) ?? null,
  };
}

/** El estado de la cocina en este momento, para el panel y el bot. */
export async function estadoCocinaDeNegocio(negocioId: string, ahora = Date.now()): Promise<EstadoCocina | null> {
  const datos = await leerCocina(negocioId);
  if (!datos) return null;
  return estadoCocina(datos.entrega, datos.horario, ahora);
}

/**
 * Escribe la pausa en el jsonb `entrega` sin tocar nada más.
 *
 * `undefined` = quitar la pausa (cocina abierta). Si no hay entrega configurada,
 * crea una mínima para guardar la pausa. Invalida la caché de la carta pública.
 */
export async function actualizarPausa(
  negocioId: string,
  pausa: EntregaConfig["pausa"],
): Promise<void> {
  const [row] = await db
    .select({ entrega: places.entrega })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  if (!row) return;

  const actual = (row.entrega as EntregaConfig | null) ?? null;

  /* Sin pausa que quitar y sin entrega que crear, no hay nada que hacer. */
  if (!pausa && !actual) return;

  const base: EntregaConfig = actual ?? {
    costo: { modo: "consultar" },
    tiempo: { min: 0, max: 0 },
  };

  const siguiente: EntregaConfig = pausa
    ? { ...base, pausa }
    : (({ pausa: _p, ...resto }) => resto)(base);

  await db
    .update(places)
    .set({ entrega: siguiente })
    .where(eq(places.id, negocioId));

  revalidateTag(CATALOG_TAG, { expire: 0 });
}

/**
 * Escribe el horario de cocina en el jsonb `entrega` sin tocar nada más.
 *
 * `null` = borrar el horario (usar el del local como fallback). Si no hay
 * entrega configurada y se quiere borrar el horario, no hay nada que hacer.
 */
export async function actualizarHorarioCocina(
  negocioId: string,
  horario: Horario | null,
): Promise<void> {
  const [row] = await db
    .select({ entrega: places.entrega })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  if (!row) return;

  const actual = (row.entrega as EntregaConfig | null) ?? null;
  if (!horario && !actual) return;

  const base: EntregaConfig = actual ?? {
    costo: { modo: "consultar" },
    tiempo: { min: 0, max: 0 },
  };

  const siguiente: EntregaConfig = horario
    ? { ...base, horario }
    : (({ horario: _h, ...resto }) => resto)(base);

  await db
    .update(places)
    .set({ entrega: siguiente })
    .where(eq(places.id, negocioId));

  revalidateTag(CATALOG_TAG, { expire: 0 });
}

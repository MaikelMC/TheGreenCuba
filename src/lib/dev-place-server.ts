import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { placeOverrides } from "@/lib/db/schema";
import { DEV_PLACE_ID, devPlace } from "@/lib/dev-place";
import type { Plan } from "@/lib/plans";
import type { UserPlace } from "@/lib/places-store";

/**
 * La copia personal del negocio de prueba.
 *
 * El fixture no vive en la base, así que para que su dueño pueda editarlo como
 * si fuera suyo sus cambios se guardan en `place_overrides` atados a su
 * usuario, y se **funden sobre el fixture** al leer. Aquí está todo lo que toca
 * esa tabla; el resto del código sigue leyendo un `UserPlace` normal y no sabe
 * que por debajo hay un fixture.
 */

/** La copia guardada, o `null` si este usuario nunca lo editó. */
export async function readDevPlaceOverride(
  userId: string,
): Promise<Partial<UserPlace> | null> {
  const [row] = await db
    .select({ data: placeOverrides.data })
    .from(placeOverrides)
    .where(eq(placeOverrides.userId, userId))
    .limit(1);
  return (row?.data as Partial<UserPlace> | undefined) ?? null;
}

/**
 * Funde la copia sobre el fixture.
 *
 * `id` y `slug` se fuerzan a los del fixture: aunque la copia los traiga —el
 * `PATCH` manda el objeto entero—, la identidad de la ficha no se edita, o el QR
 * y los enlaces dejarían de apuntar a donde apuntan.
 */
export function mergeDevPlace(
  base: UserPlace,
  override: Partial<UserPlace> | null,
): UserPlace {
  if (!override) return base;
  return { ...base, ...override, id: base.id, slug: base.slug };
}

/** El fixture con la copia del usuario ya aplicada. */
export async function getDevPlaceFor(userId: string): Promise<UserPlace> {
  return mergeDevPlace(devPlace(), await readDevPlaceOverride(userId));
}

/**
 * Guarda la copia y devuelve la ficha fusionada.
 *
 * Un `upsert` y no un `insert`: el usuario tiene como mucho una copia, y cada
 * guardado la actualiza. El `place_id` se fija aquí y no se acepta del cuerpo:
 * esta tabla es del fixture y de nadie más.
 */
export async function saveDevPlaceOverride(
  userId: string,
  patch: Partial<UserPlace>,
): Promise<UserPlace> {
  const existing = await readDevPlaceOverride(userId);
  const data = {
    ...(existing ?? {}),
    ...patch,
    id: DEV_PLACE_ID,
  } as Record<string, unknown>;

  await db
    .insert(placeOverrides)
    .values({ userId, placeId: DEV_PLACE_ID, data })
    .onConflictDoUpdate({
      target: placeOverrides.userId,
      set: { data, updatedAt: new Date() },
    });

  return mergeDevPlace(devPlace(), data as Partial<UserPlace>);
}

/**
 * El plan elegido para el fixture, o `null` (que significa gratis).
 *
 * Se lee la fila del fixture sin filtrar por usuario: es una herramienta de
 * prueba, la ve una sola cuenta y el plan describe al fixture, no a quien lo
 * mira. `planEfectivoDe(DEV_PLACE_ID)` llama aquí.
 *
 * Se ordena por `updatedAt` descendente y se toma la primera. En desarrollo
 * cualquier sesión puede tocar el plan, así que puede haber más de una fila —una
 * por usuario— y sin ordenar la lectura devolvería la que Postgres sacara
 * primero, que puede ser la vieja: elegirías Pro y seguirías viendo Gratis. El
 * plan que manda es el último que alguien eligió.
 */
export async function readDevPlacePlan(): Promise<Plan | null> {
  const [row] = await db
    .select({ plan: placeOverrides.plan })
    .from(placeOverrides)
    .where(eq(placeOverrides.placeId, DEV_PLACE_ID))
    .orderBy(desc(placeOverrides.updatedAt))
    .limit(1);
  return row?.plan ?? null;
}

/**
 * Fija el plan del fixture. Crea la fila si el usuario todavía no lo editó —el
 * `data` arranca vacío— y si ya existe solo cambia el plan, sin tocar sus
 * ediciones.
 */
export async function saveDevPlacePlan(
  userId: string,
  plan: Plan,
): Promise<void> {
  await db
    .insert(placeOverrides)
    .values({ userId, placeId: DEV_PLACE_ID, plan, data: {} })
    .onConflictDoUpdate({
      target: placeOverrides.userId,
      set: { plan, updatedAt: new Date() },
    });
}

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { placeOverrides } from "@/lib/db/schema";
import { DEV_PLACE_ID, devPlace } from "@/lib/dev-place";
import { cargarCatalogo } from "@/lib/catalogo-server";
import {
  aSuscripcion,
  funcionesDe,
  muestraSelloVerificado,
  type Catalogo,
  type Plan,
} from "@/lib/plans";
import { enlaceSeguidores } from "@/lib/seguidores";
import { siteConfig } from "@/config/site";
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

/**
 * Lo que el fixture resuelve igual que el catálogo: sello, reserva y enlace al
 * bot de avisos. Los tres dependen del plan y ninguno lo decide el navegador.
 *
 * Hace falta porque el fixture no pasa por `toUserPlace`: los demás negocios
 * llegan al cliente ya mapeados y este se construye a mano, así que sin esto su
 * `selloVerificado` no existiría y la ficha del negocio de prueba nunca lo
 * pintaría.
 *
 * Va **después** de fundir la copia del usuario —`verificado` puede venir de
 * ahí— y es `async` porque el plan vive en `place_overrides` y `mergeDevPlace`
 * no puede leerlo.
 *
 * `cat` es el catálogo de planes vigente. Opcional: quien ya lo tiene —las
 * consultas del catálogo, que lo leen para el resto de las fichas— lo pasa, y
 * quien no, lo carga aquí.
 */
export async function conSelloVerificado(
  place: UserPlace,
  cat?: Catalogo,
): Promise<UserPlace> {
  const contratado = await readDevPlaceContratado();
  const catalogo = cat ?? (await cargarCatalogo());
  const funciones = funcionesDe(
    contratado ? aSuscripcion(contratado) : null,
    new Date(),
    catalogo,
  );
  return {
    ...place,
    selloVerificado: muestraSelloVerificado(
      Boolean(place.verificado),
      funciones.has("verificado"),
    ),
    /* El botón de reserva se resuelve igual que en el catálogo: aceptado por el
       dueño, con número y con un plan que lo incluya. Aquí se repite la regla
       de `toUserPlace` a propósito —el fixture no pasa por el mapeo—, y así
       subirlo a Pro desde el panel enseña el botón sin tocar nada más. */
    reservaHabilitada:
      Boolean(place.aceptaReservas) &&
      Boolean(place.whatsapp?.trim()) &&
      funciones.has("reservas_whatsapp"),
    /* El enlace al bot se resuelve igual que en el catálogo: subirlo a Pro desde
       el panel enciende el botón sin tocar nada más. */
    enlaceSeguidores: enlaceSeguidores(
      siteConfig.telegramBot,
      place.id,
      funciones.has("seguidores"),
    ),
  };
}

/** El fixture con la copia del usuario y su sello ya aplicados. */
export async function getDevPlaceFor(
  userId: string,
  cat?: Catalogo,
): Promise<UserPlace> {
  return conSelloVerificado(
    mergeDevPlace(devPlace(), await readDevPlaceOverride(userId)),
    cat,
  );
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

  return conSelloVerificado(mergeDevPlace(devPlace(), data as Partial<UserPlace>));
}

/**
 * Lo que tiene contratado el fixture, o `null` si nadie lo tocó (que es gratis).
 *
 * Devuelve la fila con la misma forma que `suscripciones` para que
 * `aSuscripcion` la resuelva igual: el pack, los módulos sueltos y —fijos— un
 * estado `activa` sin prueba ni vencimiento, porque el fixture no se cancela ni
 * caduca, solo se cambia a voluntad.
 *
 * Se lee la fila del fixture sin filtrar por usuario: es una herramienta de
 * prueba, la ve una sola cuenta y el pack describe al fixture, no a quien lo
 * mira. `planEfectivoDe(DEV_PLACE_ID)` llama aquí.
 *
 * Se ordena por `updatedAt` descendente y se toma la primera. En desarrollo
 * cualquier sesión puede tocar el pack, así que puede haber más de una fila —una
 * por usuario— y sin ordenar la lectura devolvería la que Postgres sacara
 * primero, que puede ser la vieja: elegirías Pro y seguirías viendo Gratis. El
 * pack que manda es el último que alguien eligió.
 */
export async function readDevPlaceContratado(): Promise<{
  plan: Plan;
  estado: "activa" | "cancelada";
  trialHasta: Date | null;
  venceEn: Date | null;
  modulos: readonly { clave: string; desde: string; hasta: string | null }[];
} | null> {
  const [row] = await db
    .select({
      plan: placeOverrides.plan,
      modulos: placeOverrides.modulos,
    })
    .from(placeOverrides)
    .where(eq(placeOverrides.placeId, DEV_PLACE_ID))
    .orderBy(desc(placeOverrides.updatedAt))
    .limit(1);

  /* Sin fila no hay nada contratado; con fila y sin pack, gratis. El `estado`
     del fixture es siempre `activa`: no hay botón para cancelarlo. */
  if (!row) return null;
  return {
    plan: row.plan ?? "gratis",
    estado: "activa",
    trialHasta: null,
    venceEn: null,
    modulos: row.modulos ?? [],
  };
}

/**
 * Fija el pack del fixture. Crea la fila si el usuario todavía no lo editó —el
 * `data` arranca vacío— y si ya existe solo cambia el pack, sin tocar sus
 * ediciones ni sus módulos sueltos.
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

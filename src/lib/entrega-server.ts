/**
 * Lógica de servidor para las zonas y costo de domicilio.
 *
 * `configEntregaDe` — lectura sin comprobación de plan (el historial se lee
 * siempre; los datos guardados son del negocio).
 *
 * `configEntregaPublica` — solo devuelve algo si el negocio tiene el permiso
 * y el modo zonas está configurado con al menos una zona activa.
 *
 * `escribirEntregaParcial` — **la única puerta de escritura parcial** del
 * `jsonb`: fusiona en una sola sentencia atómica. La usan las zonas, la ficha y
 * la cocina (pausa, horario y programados), para que un guardado de zonas no
 * pueda reabrir la cocina ni borrar los programados.
 *
 * `guardarEntrega` — lo llama la ruta PATCH. Comprueba el permiso contra el
 * catálogo de fábrica (mismo patrón que `tasa-server.ts`) y delega la escritura.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { CATALOGO, funcionesDe } from "@/lib/plans";
import { suscripcionDe } from "@/lib/plans-server";
import {
  dividirParcheEntrega,
  esEntregaConfig,
  esParcheEntrega,
  fusionarEntrega,
  type EntregaConfig,
} from "@/lib/ficha/entrega";

async function tienePermiso(negocioId: string): Promise<boolean> {
  const susc = await suscripcionDe(negocioId);
  return funcionesDe(susc, new Date(), CATALOGO).has("zonas_domicilio");
}

/** La configuración de entrega del negocio, sin comprobar el plan. */
export async function configEntregaDe(negocioId: string): Promise<EntregaConfig | null> {
  const [row] = await db
    .select({ entrega: places.entrega })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);
  return row?.entrega ?? null;
}

/**
 * Lo que viaja a la carta pública.
 *
 * `null` si el negocio no tiene el permiso o no tiene zonas activas. El
 * carrito no muestra el selector de zona si esto es `null`.
 */
export async function configEntregaPublica(negocioId: string): Promise<EntregaConfig | null> {
  if (!(await tienePermiso(negocioId))) return null;
  return configEntregaDe(negocioId);
}

export type ResultadoEntregaParcial =
  | { ok: true; entrega: EntregaConfig | null }
  | { ok: false; code: "validacion" | "no_encontrado"; error: string };

/**
 * Escribe un parche de entrega en una sola sentencia atómica.
 *
 * El `UPDATE` hace
 * `entrega = (COALESCE(entrega, '{}') || $poner) - $borrar`, así que las claves
 * que no vienen en el parche **se conservan en la base**, no en una copia
 * leída antes: dos guardados simultáneos —una pausa desde Telegram y las zonas
 * desde el panel— no se pisan porque cada uno toca solo sus claves.
 *
 * Las claves con `null` van a `$borrar`; no se guardan como `null`, que en
 * `jsonb` es un valor y no una ausencia.
 *
 * Antes de escribir se valida el parche **por claves** y el resultado fusionado
 * sobre la fila leída. Si cualquiera falla, no se escribe nada.
 */
export async function escribirEntregaParcial(
  negocioId: string,
  parche: unknown,
): Promise<ResultadoEntregaParcial> {
  if (!esParcheEntrega(parche)) {
    return { ok: false, code: "validacion", error: "Configuración de entrega inválida." };
  }

  const [fila] = await db
    .select({ entrega: places.entrega })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  if (!fila) {
    return { ok: false, code: "no_encontrado", error: "Negocio no encontrado." };
  }

  const actual = (fila.entrega as EntregaConfig | null) ?? null;
  const fusionada = fusionarEntrega(actual, parche);
  if (!fusionada || !esEntregaConfig(fusionada)) {
    return { ok: false, code: "validacion", error: "Configuración de entrega inválida." };
  }

  const { poner, borrar } = dividirParcheEntrega(parche);

  /* Sin entrega previa y sin nada que poner, no hay nada que crear: borrar una
     pausa o un horario que no existen no debe inventar un objeto vacío. */
  if (!actual && Object.keys(poner).length === 0) {
    return { ok: true, entrega: null };
  }

  /* `COALESCE` cubre la fila que nunca tuvo entrega; `||` fusiona solo las
     claves del parche y cada `-` quita una clave anulada. La expresión va
     entera en el `SET`, así que la base decide sobre el valor más reciente. */
  let expresion = sql`(COALESCE(${places.entrega}, '{}'::jsonb) || ${JSON.stringify(poner)}::jsonb)`;
  for (const clave of borrar) {
    expresion = sql`${expresion} - ${clave}`;
  }

  const [actualizada] = await db
    .update(places)
    .set({ entrega: expresion })
    .where(eq(places.id, negocioId))
    .returning({ entrega: places.entrega });

  if (!actualizada) {
    return { ok: false, code: "no_encontrado", error: "Negocio no encontrado." };
  }

  return {
    ok: true,
    entrega: (actualizada.entrega as EntregaConfig | null) ?? null,
  };
}

export type GuardarEntregaResult =
  | { success: true }
  | { success: false; error: string; code: "plan" | "validacion" };

export async function guardarEntrega(
  negocioId: string,
  config: unknown,
): Promise<GuardarEntregaResult> {
  if (!(await tienePermiso(negocioId))) {
    return {
      success: false,
      code: "plan",
      error: "Las zonas de domicilio entran con el módulo Pedidos y reservas.",
    };
  }

  const resultado = await escribirEntregaParcial(negocioId, config);
  if (!resultado.ok) {
    return { success: false, code: "validacion", error: resultado.error };
  }

  return { success: true };
}

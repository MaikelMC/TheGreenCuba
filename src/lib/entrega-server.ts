/**
 * Lógica de servidor para las zonas y costo de domicilio.
 *
 * `configEntregaDe` — lectura sin comprobación de plan (el historial se lee
 * siempre; los datos guardados son del negocio).
 *
 * `configEntregaPublica` — solo devuelve algo si el negocio tiene el permiso
 * y el modo zonas está configurado con al menos una zona activa.
 *
 * `guardarEntrega` — lo llama la ruta PATCH. Comprueba el permiso contra el
 * catálogo de fábrica (mismo patrón que `tasa-server.ts`) y valida antes de
 * escribir.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { CATALOGO, funcionesDe } from "@/lib/plans";
import { suscripcionDe } from "@/lib/plans-server";
import { esEntregaConfig, type EntregaConfig } from "@/lib/ficha/entrega";

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

  if (!esEntregaConfig(config)) {
    return { success: false, code: "validacion", error: "Configuración de entrega inválida." };
  }

  await db.update(places).set({ entrega: config }).where(eq(places.id, negocioId));

  return { success: true };
}

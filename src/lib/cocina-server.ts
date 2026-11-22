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
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { estadoCocina, type EstadoCocina } from "@/lib/ficha/cocina";
import type { EntregaConfig, ProgramadosConfig } from "@/lib/ficha/entrega";
import { escribirEntregaParcial } from "@/lib/entrega-server";
import { proximaAperturaMs, type Horario } from "@/lib/ficha/horario";

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
 * Abre o cierra la cocina a mano, en el jsonb `entrega`, sin tocar nada más.
 *
 * - **Cerrar** (`pausa`): guarda la pausa y quita la apertura manual.
 * - **Abrir** (`undefined`): quita la pausa y, si el horario de cocina dice
 *   que ahora está cerrada, guarda una apertura manual que gana al horario
 *   hasta su próxima apertura (desde ahí manda el horario) o hasta que se
 *   cierre. Antes «Abrir» solo quitaba la pausa, y fuera de horario la cocina
 *   seguía cerrada aunque el panel dijera «Cocina abierta».
 *
 * Devuelve la apertura manual guardada (o `null`). Invalida la caché de la
 * carta y la ficha.
 */
export async function actualizarPausa(
  negocioId: string,
  pausa: EntregaConfig["pausa"],
): Promise<EntregaConfig["aperturaManual"] | null> {
  let aperturaManual: EntregaConfig["aperturaManual"] | null = null;
  if (!pausa) {
    const datos = await leerCocina(negocioId);
    if (datos) {
      const ahora = new Date();
      const { pausa: _p, aperturaManual: _a, ...sinManual } = datos.entrega ?? {
        costo: { modo: "consultar" as const },
        tiempo: { min: 0, max: 0 },
      };
      const horarioCocina = datos.entrega?.horario ?? datos.horario;
      const cerradaPorHorario = !estadoCocina(
        sinManual as EntregaConfig,
        datos.horario,
        ahora.getTime(),
      ).abierta;
      if (cerradaPorHorario && horarioCocina) {
        aperturaManual = {
          desde: ahora.getTime(),
          hasta: proximaAperturaMs(horarioCocina, ahora),
        };
      }
    }
  }

  const resultado = await escribirEntregaParcial(negocioId, {
    pausa: pausa ?? null,
    aperturaManual,
  });
  if (!resultado.ok) return null;

  /* La invalidación la hace `escribirEntregaParcial`, puerta única de escritura. */
  return aperturaManual;
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
  const resultado = await escribirEntregaParcial(negocioId, { horario });
  if (!resultado.ok) return;
  /* `escribirEntregaParcial` ya invalidó el catálogo. */
}

/**
 * Escribe la configuración de pedidos programados en `entrega.programados`.
 *
 * `null` = borrar la config. Invalida la caché pública: el carrito consulta
 * esto para saber si debe mostrar el selector de franjas.
 */
export async function actualizarProgramados(
  negocioId: string,
  programados: ProgramadosConfig | null,
): Promise<void> {
  const resultado = await escribirEntregaParcial(negocioId, {
    programados: programados ?? null,
  });
  if (!resultado.ok) return;
  /* `escribirEntregaParcial` ya invalidó el catálogo. */
}

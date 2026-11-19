import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import {
  aperturaManualPara,
  aperturaManualVigente,
  esHorario,
  sinAperturaManual,
  type Horario,
} from "@/lib/ficha/horario";
import type { PlaceStatus } from "@/lib/places-store";

/**
 * El horario que hay que guardar cuando el dueño abre o cierra a mano.
 *
 * - **Abrir a mano** (`abrirAhora`) fuera de horario: se añade una apertura
 *   manual que gana al horario hasta la próxima apertura que marca —desde ahí
 *   manda el horario— o hasta que cierre. Dentro de horario no hace falta nada.
 * - **Cerrar a mano**: se quita la apertura manual; el cierre ya lo hace
 *   `status`.
 * - **Guardar el horario** sin tocar el estado: se conserva la apertura manual
 *   vigente, para que editar las franjas no cierre lo que el dueño abrió.
 *
 * Devuelve el horario a escribir, o `undefined` si no hay nada que cambiar.
 */
export async function horarioConApertura(
  placeId: string,
  cambio: { status?: PlaceStatus; abrirAhora?: boolean; horario?: Horario | null },
  ahora: Date = new Date(),
): Promise<Horario | null | undefined> {
  const [fila] = await db
    .select({ horario: places.horario })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);
  const guardado = esHorario(fila?.horario) ? fila.horario : null;
  const enviado = cambio.horario;
  const base = enviado !== undefined ? enviado : guardado;
  if (!base) return enviado;

  if (cambio.status === "active" && cambio.abrirAhora) {
    const manual = aperturaManualPara(base, ahora);
    const limpio = sinAperturaManual(base);
    return manual ? { ...limpio, aperturaManual: manual } : limpio;
  }

  if (cambio.status === "closed" || cambio.status === "temporary_closed") {
    return base.aperturaManual ? sinAperturaManual(base) : enviado;
  }

  if (
    enviado &&
    !enviado.aperturaManual &&
    guardado?.aperturaManual &&
    aperturaManualVigente(guardado.aperturaManual, ahora.getTime())
  ) {
    return { ...enviado, aperturaManual: guardado.aperturaManual };
  }
  return enviado;
}

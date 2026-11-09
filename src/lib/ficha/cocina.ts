/**
 * Estado de la cocina para pedidos a domicilio.
 *
 * Módulo puro: no importa React ni Drizzle. Lo leen el servidor (para pintar
 * el banner en la carta), el cliente (para deshabilitar el botón de pedido) y
 * el Telegram del dueño (para mostrar el estado con `/cocina`).
 *
 * Tres capas, en orden:
 *   1. Pausa manual (`entrega.pausa`): el dueño cerró a mano. Manda siempre.
 *   2. Horario de cocina (`entrega.horario`): si no hay pausa, se mira este.
 *   3. Horario del local (`places.horario`): fallback si no hay horario de cocina.
 *   4. Sin horario configurado: cocina abierta (no afirmamos nada).
 */

import { estadoApertura } from "./horario";
import type { Horario } from "./horario";
import type { EntregaConfig } from "./entrega";

export interface EstadoCocina {
  abierta: boolean;
  /** Motivo de la pausa manual, si la hay. */
  motivo: string | null;
  /** Timestamp (ms) en que se reabre automáticamente. `null` = indefinido. */
  vuelveA: number | null;
  /** Texto para el cliente: «Cocina cerrada · abre a las 18:00» etc. */
  texto: string;
}

const TZ = "America/Havana";

/**
 * El estado de la cocina en un instante dado.
 *
 * `ahora` es un timestamp en ms (Date.now()). Se pasa en vez de crear `new Date()`
 * dentro para que el servidor pueda pasar el `nowIso` que ya tiene y los tests
 * puedan fijar el momento exacto.
 */
export function estadoCocina(
  entrega: EntregaConfig | null | undefined,
  placeHorario: Horario | null | undefined,
  ahora: number = Date.now(),
): EstadoCocina {
  /* ── 1. Pausa manual ───────────────────────────────────────────────────── */
  const pausa = entrega?.pausa;
  if (pausa) {
    const expirada =
      pausa.hasta !== null && pausa.hasta <= ahora;

    if (!expirada) {
      const motivo = pausa.motivo ?? null;
      const vuelveA = pausa.hasta;

      let texto = "Cocina cerrada";
      if (motivo) texto += ` · ${motivo}`;
      if (vuelveA !== null) {
        const hora = new Intl.DateTimeFormat("es-CU", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: TZ,
        }).format(new Date(vuelveA));
        texto += ` · abre a las ${hora}`;
      } else {
        texto += " · reabre cuando el dueño lo indique";
      }

      return { abierta: false, motivo, vuelveA, texto };
    }
  }

  /* ── 2 & 3. Horario (cocina o local) ──────────────────────────────────── */
  const horario = entrega?.horario ?? placeHorario ?? null;

  if (!horario) {
    return { abierta: true, motivo: null, vuelveA: null, texto: "Cocinando ahora" };
  }

  const now = new Date(ahora);
  const estado = estadoApertura({ horario, now, tz: TZ });

  if (estado.sinHorario) {
    return { abierta: true, motivo: null, vuelveA: null, texto: "Cocinando ahora" };
  }

  if (estado.abierto) {
    let texto = "Cocinando ahora";
    if (estado.cierraA) texto += ` · cierra a las ${estado.cierraA}`;
    return { abierta: true, motivo: null, vuelveA: null, texto };
  }

  /* Cerrada por horario. */
  let texto = "Cocina cerrada";
  if (estado.abreA) {
    if (estado.diasHastaApertura === 0) {
      texto += ` · abre a las ${estado.abreA}`;
    } else if (estado.diasHastaApertura === 1) {
      texto += ` · abre mañana a las ${estado.abreA}`;
    } else if (estado.abreDia !== null) {
      const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
      texto += ` · abre el ${dias[estado.abreDia]} a las ${estado.abreA}`;
    }
  }

  return { abierta: false, motivo: null, vuelveA: null, texto };
}

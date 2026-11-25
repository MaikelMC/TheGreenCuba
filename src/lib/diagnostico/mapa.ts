/** Máquina de estados pura de una carga de mapa. */
import type { MotivoMapa, TipoDiagnostico } from "./eventos";

export interface EstadoMapa {
  iniciado: boolean;
  cargado: boolean;
  error: boolean;
  abandonado: boolean;
  lento: boolean;
}

export const ESTADO_MAPA_INICIAL: EstadoMapa = {
  iniciado: false,
  cargado: false,
  error: false,
  abandonado: false,
  lento: false,
};

export type AccionMapa =
  | { tipo: "inicio" }
  | { tipo: "cargado"; ms: number }
  | { tipo: "lento"; ms: number }
  | { tipo: "error"; motivo: MotivoMapa }
  | { tipo: "abandonado"; ms: number };

export interface EventoMapa {
  tipo: TipoDiagnostico;
  datos: Record<string, unknown>;
}

export interface ResultadoAccionMapa {
  estado: EstadoMapa;
  eventos: EventoMapa[];
}

/**
 * Decide qué eventos corresponden a cada gesto y garantiza que no haya dos
 * cargas, dos errores ni un abandono después de terminar.
 */
export function aplicarAccionMapa(
  estado: EstadoMapa,
  accion: AccionMapa,
): ResultadoAccionMapa {
  if (accion.tipo === "inicio") {
    if (estado.iniciado) return { estado, eventos: [] };
    return {
      estado: { ...estado, iniciado: true },
      eventos: [{ tipo: "mapa_inicio", datos: {} }],
    };
  }

  if (accion.tipo === "cargado") {
    if (estado.cargado || estado.error || estado.abandonado) {
      return { estado, eventos: [] };
    }
    const eventos: EventoMapa[] = [
      {
        tipo: "mapa_cargado",
        datos: { msDesdeMontaje: accion.ms, msHastaIdle: accion.ms },
      },
    ];
    const lento = accion.ms >= 8000;
    if (lento && !estado.lento) {
      eventos.push({
        tipo: "mapa_lento",
        datos: { msDesdeMontaje: accion.ms },
      });
    }
    return {
      estado: { ...estado, cargado: true, lento: estado.lento || lento },
      eventos,
    };
  }

  if (accion.tipo === "lento") {
    if (estado.lento || estado.error || estado.abandonado) {
      return { estado, eventos: [] };
    }
    return {
      estado: { ...estado, lento: true },
      eventos: [
        { tipo: "mapa_lento", datos: { msDesdeMontaje: accion.ms } },
      ],
    };
  }

  if (accion.tipo === "error") {
    if (estado.error || estado.cargado || estado.abandonado) {
      return { estado, eventos: [] };
    }
    return {
      estado: { ...estado, error: true },
      eventos: [{ tipo: "mapa_error", datos: { motivo: accion.motivo } }],
    };
  }

  if (estado.cargado || estado.error || estado.abandonado) {
    return { estado, eventos: [] };
  }
  return {
    estado: { ...estado, abandonado: true },
    eventos: [
      { tipo: "mapa_abandonado", datos: { msDesdeMontaje: accion.ms } },
    ],
  };
}

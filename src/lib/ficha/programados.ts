/**
 * Lógica pura de pedidos programados por franja horaria.
 *
 * Módulo sin base de datos ni React: lo lee el servidor para el endpoint de
 * franjas, el carrito del cliente (tras hidratarse) y las pruebas. La clave de
 * diseño es que `franjasDisponibles` no sabe de dónde vienen los datos: recibe
 * la config, el horario y la ocupación ya resueltos.
 *
 * **Zona horaria.** Cuba es `America/Havana` (UTC-5 estándar, UTC-4 DST).
 * `localAUtc` convierte hora local → UTC probando los dos offsets y verificando
 * con `Intl` cuál reproduce la misma hora local. En la ventana de ambigüedad
 * (el reloj atrasa) gana UTC-5.
 */

import {
  DIAS_SEMANA,
  formatearHora,
  parseHora,
  relojEn,
  sumarDias,
  type Franja,
  type Horario,
} from "./horario";
import type { ProgramadosConfig } from "./entrega";

/* ── tipos públicos ────────────────────────────────────────────────────── */

export interface FranjaDisponible {
  /** Inicio en UTC. */
  inicio: Date;
  /** Fin en UTC. */
  fin: Date;
  /** `true` si el cupo está completo y no se debe ofrecer. */
  llena: boolean;
  /** «09:30 – 10:00» en hora local del negocio. */
  etiqueta: string;
}

export interface DiaDisponible {
  /** `YYYY-MM-DD` en la zona del negocio. */
  fecha: string;
  /** «Hoy», «Mañana» o «Mié. 12». */
  etiqueta: string;
  franjas: FranjaDisponible[];
}

/* ── utilidades internas ───────────────────────────────────────────────── */

/**
 * Convierte hora local (minutos desde medianoche) + fecha `YYYY-MM-DD` a UTC.
 *
 * Prueba UTC-5 (estándar) y luego UTC-4 (DST). Verifica cuál reproduce los
 * mismos minutos en `Intl`. Cae a UTC-5 si ninguno cuadra (ventana de
 * ambigüedad al atrasar el reloj).
 */
function localAUtc(fecha: string, horaMins: number, tz: string): Date {
  const [y = 1970, m = 1, d = 1] = fecha.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (const offsetH of [5, 4]) {
    const ms = base + horaMins * 60_000 + offsetH * 3_600_000;
    const utc = new Date(ms);
    const parts = fmt.formatToParts(utc);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const mn = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    if (h * 60 + mn === horaMins % 1440) return utc;
  }
  return new Date(base + horaMins * 60_000 + 5 * 3_600_000);
}

function franjasDelDiaLocal(horario: Horario, fecha: string, dia: number): Franja[] {
  const excepcion = horario.excepciones?.find((e) => e.fecha === fecha);
  if (excepcion) {
    if (excepcion.cerrado) return [];
    return excepcion.franjas ?? [];
  }
  return horario.semana[DIAS_SEMANA[dia] ?? "dom"] ?? [];
}

/** Divide una franja horaria en slots de `franjaMin` minutos. */
function slotsDe(franja: Franja, franjaMin: number): number[] {
  const abre = parseHora(franja.abre);
  const cierra = parseHora(franja.cierra);
  if (abre === null || cierra === null) return [];
  const fin = cierra <= abre ? cierra + 1440 : cierra;
  const slots: number[] = [];
  for (let m = abre; m + franjaMin <= fin; m += franjaMin) {
    slots.push(m);
  }
  return slots;
}

const DIAS_LABEL = ["dom.", "lun.", "mar.", "mié.", "jue.", "vie.", "sáb."];

/** «Hoy», «Mañana» o «Mié. 12» para un offset de días desde hoy. */
export function etiquetaDia(fecha: string, offset: number): string {
  if (offset === 0) return "Hoy";
  if (offset === 1) return "Mañana";
  const [, , d = "1"] = fecha.split("-");
  /* El día de semana sale de UTC porque la fecha ya es local del negocio. */
  const [y = 1970, mo = 1, day = 1] = fecha.split("-").map(Number);
  const diaSem = new Date(Date.UTC(y, mo - 1, day)).getUTCDay();
  return `${DIAS_LABEL[diaSem] ?? ""} ${Number(d)}`;
}

/* ── función principal ─────────────────────────────────────────────────── */

/**
 * Días y franjas disponibles para pedidos programados.
 *
 * @param config  Configuración del negocio (programados activo, días, etc.).
 * @param horario Horario de cocina (`entrega.horario`) o del local si no hay.
 *   `null` → sin franjas que ofrecer.
 * @param ahora   Fecha/hora actual (UTC). Facilita pruebas.
 * @param ocupacion Mapa de ISO string del inicio de franja (UTC) → pedidos en ese slot.
 * @param tz      Zona horaria del negocio. `America/Havana` por defecto.
 */
export function franjasDisponibles(
  config: ProgramadosConfig,
  horario: Horario | null,
  ahora: Date,
  ocupacion: Map<string, number>,
  tz = "America/Havana",
): DiaDisponible[] {
  if (!config.activo || !horario) return [];

  const reloj = relojEn(ahora, tz);
  const resultado: DiaDisponible[] = [];

  for (let offset = 0; offset <= config.diasMax; offset++) {
    const fecha = offset === 0 ? reloj.fecha : sumarDias(reloj.fecha, offset);
    const diaSemana = (reloj.dia + offset) % 7;
    const franjasHoy = franjasDelDiaLocal(horario, fecha, diaSemana);

    const disponibles: FranjaDisponible[] = [];
    for (const franja of franjasHoy) {
      for (const minInicio of slotsDe(franja, config.franjaMin)) {
        /* Hoy: requiere antelación mínima. */
        if (offset === 0 && minInicio <= reloj.minutos + config.antelacionMin) {
          continue;
        }
        const minFin = minInicio + config.franjaMin;
        const utcInicio = localAUtc(fecha, minInicio, tz);
        const utcFin = localAUtc(fecha, minFin, tz);
        const key = utcInicio.toISOString();
        const count = ocupacion.get(key) ?? 0;
        const llena =
          config.cupoPorFranja !== null && count >= config.cupoPorFranja;

        disponibles.push({
          inicio: utcInicio,
          fin: utcFin,
          llena,
          etiqueta: `${formatearHora(minInicio)} – ${formatearHora(minFin)}`,
        });
      }
    }

    if (disponibles.length === 0) continue;
    resultado.push({ fecha, etiqueta: etiquetaDia(fecha, offset), franjas: disponibles });
  }

  return resultado;
}

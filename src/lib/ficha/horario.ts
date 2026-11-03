/**
 * El horario del negocio y si está abierto ahora mismo.
 *
 * Módulo puro —sin base de datos ni React— porque lo leen el servidor (para el
 * HTML inicial), el navegador (que lo recalcula cada minuto, para que la caché
 * de cinco minutos de la ficha no congele un «Abierto» que ya es mentira) y las
 * pruebas.
 *
 * **La zona horaria manda.** Cuba es `America/Havana` y el servidor puede
 * correr en UTC: calcular con `Date.getHours()` abriría y cerraría el negocio
 * cinco horas antes. Todo se resuelve con `Intl.DateTimeFormat`, sin
 * dependencias nuevas.
 *
 * Una franja con `cierra <= abre` cruza medianoche (`23:00–02:00`). Por eso el
 * día de ayer también puede tener al negocio abierto a la una de la mañana, y
 * `estadoApertura` lo mira.
 */

/** Los días en el orden de `Date.getDay()`: 0 = domingo. */
export const DIAS_SEMANA = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

/** Cómo se llama cada día en la ficha. */
export const DIA_SEMANA_LABEL: Record<DiaSemana, string> = {
  dom: "domingo",
  lun: "lunes",
  mar: "martes",
  mie: "miércoles",
  jue: "jueves",
  vie: "viernes",
  sab: "sábado",
};

/** Una franja del día, en `HH:MM` de 24 horas. */
export interface Franja {
  abre: string;
  cierra: string;
}

/** Un día concreto que se sale de la semana normal. */
export interface ExcepcionHorario {
  /** `YYYY-MM-DD`, en hora local del negocio. */
  fecha: string;
  /** `true` = cerrado todo el día. */
  cerrado?: boolean;
  /** Texto que se pinta en la ficha («Cerrado por inventario»). */
  mensaje?: string;
  /** Si no está cerrado, las franjas de ese día. */
  franjas?: Franja[];
}

/**
 * El horario tal como se guarda en `places.horario`.
 *
 * `semana` es parcial a propósito: un día ausente es un día cerrado, que es lo
 * que significa no haberlo configurado. `excepciones` cubre festivos y cierres
 * puntuales.
 */
export interface Horario {
  semana: Partial<Record<DiaSemana, Franja[]>>;
  excepciones?: ExcepcionHorario[];
}

/** Lo que devuelve `estadoApertura`, ya sin textos: los copys van aparte. */
export interface EstadoApertura {
  abierto: boolean;
  /** No hay horario configurado: la ficha no puede afirmar nada. */
  sinHorario: boolean;
  /** `HH:MM` en que cierra la franja abierta, si se conoce. */
  cierraA: string | null;
  /** `HH:MM` de la próxima apertura, si está cerrado y se conoce. */
  abreA: string | null;
  /** Día de la próxima apertura: 0 = domingo. */
  abreDia: number | null;
  /** Días que faltan para esa apertura. `0` = hoy, `1` = mañana. */
  diasHastaApertura: number | null;
  /** Mensaje de la excepción o del cierre temporal, si lo hay. */
  mensaje: string | null;
}

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `"09:30"` → 570 minutos. `null` si no es una hora válida. */
export function parseHora(hora: string): number | null {
  const m = HORA_RE.exec(hora.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 570 → `"09:30"`. */
export function formatearHora(minutos: number): string {
  const normal = ((minutos % 1440) + 1440) % 1440;
  const h = Math.floor(normal / 60);
  const m = normal % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** ¿Es una franja con dos horas válidas y distintas? */
export function esFranja(value: unknown): value is Franja {
  if (!value || typeof value !== "object") return false;
  const f = value as Partial<Franja>;
  if (typeof f.abre !== "string" || typeof f.cierra !== "string") return false;
  const abre = parseHora(f.abre);
  const cierra = parseHora(f.cierra);
  return abre !== null && cierra !== null && abre !== cierra;
}

function esExcepcion(value: unknown): value is ExcepcionHorario {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<ExcepcionHorario>;
  if (typeof e.fecha !== "string" || !FECHA_RE.test(e.fecha)) return false;
  if (e.cerrado !== undefined && typeof e.cerrado !== "boolean") return false;
  if (e.mensaje !== undefined && typeof e.mensaje !== "string") return false;
  if (e.franjas !== undefined) {
    if (!Array.isArray(e.franjas) || !e.franjas.every(esFranja)) return false;
  }
  /* Un día que no está cerrado necesita franjas; sin ellas se leería como
     cerrado y el mensaje de la excepción mentiría. */
  if (!e.cerrado && (e.franjas === undefined || e.franjas.length === 0)) {
    return false;
  }
  return true;
}

/** Valida el jsonb entero antes de guardarlo. */
export function esHorario(value: unknown): value is Horario {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const h = value as Partial<Horario>;
  if (!h.semana || typeof h.semana !== "object" || Array.isArray(h.semana)) {
    return false;
  }
  for (const [dia, franjas] of Object.entries(h.semana)) {
    if (!(DIAS_SEMANA as readonly string[]).includes(dia)) return false;
    if (!Array.isArray(franjas) || !franjas.every(esFranja)) return false;
  }
  if (h.excepciones !== undefined) {
    if (!Array.isArray(h.excepciones) || !h.excepciones.every(esExcepcion)) {
      return false;
    }
  }
  return true;
}

/* ── Horarios escritos a mano ─────────────────────────────────────────── */

/**
 * Lo que se puede afirmar leyendo el `schedule` de una ficha antigua.
 *
 * `desconocido` es una respuesta legítima: el texto no trae una hora que se
 * pueda comprobar. Antes se devolvía «abierto» para todo lo que no fuera «De
 * día» o «De noche» —«9:00 a.m. - 6:00 p.m.» a las diez de la noche incluida—,
 * así que media ciudad salía abierta en la ficha y en las tarjetas.
 */
export type EstadoTexto = "abierto" | "cerrado" | "desconocido";

/* De día / de noche, cuando el horario solo dice eso. */
const DIA_DESDE = 8;
const DIA_HASTA = 19;

/* Dos horas separadas por guion, «a» o «hasta», con el am/pm opcional en cada
   una: «9:00 a.m. - 6:00 p.m.», «9am–6pm», «09:00-18:00», «9 a 6». */
const RANGO_RE =
  /(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*(?:-|–|—|a|hasta)\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?/i;

/* Un horario que nombra días («Lun-Sáb 9-6») no se puede juzgar sin leer qué
   días son: mejor no afirmar nada que acertar cinco días de siete. */
const DIA_NOMBRE_RE =
  /\b(dom|lun|mar|mie|jue|vie|sab|domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/;

/** Minutos desde medianoche de una hora suelta, o `null` si hay que adivinar. */
function minutoDe(
  hora: string,
  minuto: string | undefined,
  meridiem: string | undefined,
): number | null {
  const h = Number(hora);
  const m = minuto ? Number(minuto) : 0;
  if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) {
    return null;
  }
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    return (h % 12) * 60 + m + (meridiem.toLowerCase() === "p" ? 720 : 0);
  }
  return h * 60 + m;
}

const SIN_AFIRMAR = { estado: "desconocido" as const, cierraA: null };

/**
 * El estado que se puede leer de un horario en texto libre.
 *
 * Solo se interpretan los formatos en los que no hay que adivinar: un rango de
 * horas con am/pm en cada punta, un rango en 24 horas, «de día», «de noche»,
 * «todo el día» y «cerrado». Todo lo demás devuelve `desconocido`.
 */
export function estadoDesdeTexto(
  schedule: string | null | undefined,
  now: Date = new Date(),
  tz = "America/Havana",
): { estado: EstadoTexto; cierraA: string | null } {
  /* Sin tildes y en minúsculas: el dueño escribe «De día», «de dia» y «DÍA»,
     y las tres quieren decir lo mismo. */
  const texto = (schedule ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (!texto) return SIN_AFIRMAR;

  if (/todo el dia|24\s*(h|horas)|siempre abierto/.test(texto)) {
    return { estado: "abierto", cierraA: null };
  }

  if (/^(cerrad|no abre)/.test(texto)) {
    return { estado: "cerrado", cierraA: null };
  }

  const rango = RANGO_RE.exec(texto);
  if (rango) {
    if (DIA_NOMBRE_RE.test(texto)) return SIN_AFIRMAR;

    const [, h1 = "", m1, mer1, h2 = "", m2, mer2] = rango;
    const abre = minutoDe(h1, m1, mer1);
    const cierra = minutoDe(h2, m2, mer2);
    /* Sin am/pm en ninguna punta, «9-6» lo mismo puede ser de la mañana que de
       la noche: una de las dos lecturas siempre sería mentira. Solo se acepta
       si alguna hora pasa de las 12, que ya la delata en formato de 24 horas. */
    const ambiguo = !mer1 && !mer2 && Number(h1) <= 12 && Number(h2) <= 12;
    if (abre === null || cierra === null || ambiguo || abre === cierra) {
      return SIN_AFIRMAR;
    }

    const fin = cierra <= abre ? cierra + 1440 : cierra;
    const { minutos } = relojEn(now, tz);
    /* La franja de «ayer» también cuenta: un 10 p.m.–2 a.m. está abierto a la
       una de la mañana, igual que en el horario estructurado. */
    let cierre: number | null = null;
    if (minutos >= abre && minutos < fin) cierre = fin;
    else if (minutos + 1440 >= abre && minutos + 1440 < fin) cierre = fin - 1440;

    return cierre === null
      ? { estado: "cerrado", cierraA: null }
      : { estado: "abierto", cierraA: formatearHora(cierre) };
  }

  const { minutos } = relojEn(now, tz);
  const deDia = minutos >= DIA_DESDE * 60 && minutos < DIA_HASTA * 60;

  if (/de noche|nocturn/.test(texto)) {
    return { estado: deDia ? "cerrado" : "abierto", cierraA: null };
  }
  if (/de dia|diurn/.test(texto)) {
    return { estado: deDia ? "abierto" : "cerrado", cierraA: null };
  }

  return SIN_AFIRMAR;
}

/**
 * El estado que se puede enseñar, con horario estructurado o sin él.
 *
 * `status` manda: un negocio cerrado por el dueño no abre aunque su horario
 * diga que sí. `desconocido` significa que no hay nada que afirmar, y quien
 * pinta decide si se calla o enseña el texto tal cual.
 */
export function estadoAhora({
  horario,
  schedule,
  status = "active",
  now = new Date(),
  tz = "America/Havana",
}: {
  horario?: Horario | null;
  schedule?: string | null;
  status?: "active" | "closed" | "temporary_closed";
  now?: Date;
  tz?: string;
}): EstadoTexto {
  if (status !== "active") return "cerrado";
  const estado = estadoApertura({ horario, status, now, tz });
  if (!estado.sinHorario) return estado.abierto ? "abierto" : "cerrado";
  return estadoDesdeTexto(schedule, now, tz).estado;
}

/* ── Reloj en la zona del negocio ─────────────────────────────────────── */

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formateador(tz: string): Intl.DateTimeFormat {
  const cached = FORMATTERS.get(tz);
  if (cached) return cached;
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  FORMATTERS.set(tz, f);
  return f;
}

const DIA_POR_NOMBRE: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface Reloj {
  /** 0 = domingo … 6 = sábado, en la zona del negocio. */
  dia: number;
  /** Minutos desde medianoche, en la zona del negocio. */
  minutos: number;
  /** `YYYY-MM-DD` en la zona del negocio. */
  fecha: string;
}

function relojEn(now: Date, tz: string): Reloj {
  const partes = formateador(tz).formatToParts(now);
  const dato = (tipo: string): string =>
    partes.find((p) => p.type === tipo)?.value ?? "";

  const dia = DIA_POR_NOMBRE[dato("weekday")] ?? now.getUTCDay();
  const minutos = Number(dato("hour")) * 60 + Number(dato("minute"));
  return {
    dia,
    minutos,
    fecha: `${dato("year")}-${dato("month")}-${dato("day")}`,
  };
}

/** Suma días a una fecha `YYYY-MM-DD` sin pasar por la zona horaria. */
function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const ms = Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + dias);
  const fechaMs = new Date(ms);
  return [
    fechaMs.getUTCFullYear(),
    String(fechaMs.getUTCMonth() + 1).padStart(2, "0"),
    String(fechaMs.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function franjasDelDia(horario: Horario, fecha: string, dia: number): Franja[] {
  const excepcion = horario.excepciones?.find((e) => e.fecha === fecha);
  if (excepcion) {
    if (excepcion.cerrado) return [];
    return excepcion.franjas ?? [];
  }
  return horario.semana[DIAS_SEMANA[dia] ?? "dom"] ?? [];
}

/**
 * Si `minutos` cae dentro de una franja, los minutos en que cierra.
 *
 * La franja puede empezar «ayer» cuando cruza medianoche, por eso el llamador
 * le pasa `minutos + 1440` para las de ayer.
 */
function cierreDentro(franja: Franja, minutos: number): number | null {
  const abre = parseHora(franja.abre);
  const cierra = parseHora(franja.cierra);
  if (abre === null || cierra === null) return null;
  const fin = cierra <= abre ? cierra + 1440 : cierra;
  if (minutos >= abre && minutos < fin) return fin;
  return null;
}

function horarioVacio(horario: Horario): boolean {
  const dias = Object.values(horario.semana);
  return (
    dias.every((franjas) => !franjas || franjas.length === 0) &&
    (horario.excepciones?.length ?? 0) === 0
  );
}

/**
 * ¿Está abierto ahora? ¿Y si no, cuándo abre?
 *
 * `status` manda sobre el horario: un negocio cerrado temporalmente no abre
 * aunque su horario diga que sí. Las excepciones mandan sobre la semana: el día
 * que el dueño marcó cerrado lo está aunque su horario habitual lo abriera.
 *
 * Si no hay horario configurado devuelve `sinHorario: true` y `abierto: false`;
 * quien pinta decide el respaldo (el heurístico de `schedule` en la ficha).
 */
export function estadoApertura({
  horario,
  status = "active",
  mensajeCierre,
  now = new Date(),
  tz = "America/Havana",
}: {
  horario: Horario | null | undefined;
  status?: "active" | "closed" | "temporary_closed";
  mensajeCierre?: string | null;
  now?: Date;
  tz?: string;
}): EstadoApertura {
  if (status === "closed" || status === "temporary_closed") {
    return {
      abierto: false,
      sinHorario: false,
      cierraA: null,
      abreA: null,
      abreDia: null,
      diasHastaApertura: null,
      mensaje: mensajeCierre?.trim() || null,
    };
  }

  if (!horario || horarioVacio(horario)) {
    return {
      abierto: false,
      sinHorario: true,
      cierraA: null,
      abreA: null,
      abreDia: null,
      diasHastaApertura: null,
      mensaje: null,
    };
  }

  const hoy = relojEn(now, tz);
  const ayerFecha = sumarDias(hoy.fecha, -1);
  const ayerDia = (hoy.dia + 6) % 7;

  /* Se miran las franjas de hoy y las de ayer, porque una franja que cruza
     medianoche sigue abierta de madrugada. De las que contienen el momento se
     queda la que cierra antes: es la que de verdad manda cuando se solapan. */
  let cierre: number | null = null;
  const candidatas = [
    ...franjasDelDia(horario, hoy.fecha, hoy.dia).map((f) => ({
      franja: f,
      minutos: hoy.minutos,
    })),
    ...franjasDelDia(horario, ayerFecha, ayerDia).map((f) => ({
      franja: f,
      minutos: hoy.minutos + 1440,
    })),
  ];
  for (const { franja, minutos } of candidatas) {
    const fin = cierreDentro(franja, minutos);
    if (fin !== null && (cierre === null || fin < cierre)) cierre = fin;
  }

  const excepcionHoy = horario.excepciones?.find((e) => e.fecha === hoy.fecha);

  if (cierre !== null) {
    return {
      abierto: true,
      sinHorario: false,
      cierraA: formatearHora(cierre),
      abreA: null,
      abreDia: null,
      diasHastaApertura: null,
      /* El mensaje de la excepción se enseña también cuando está abierto: «Hoy
         cerramos a las 3» es justo lo que hay que leer antes de salir. */
      mensaje: excepcionHoy?.mensaje?.trim() || null,
    };
  }

  /* Cerrado: se busca la próxima apertura, empezando por lo que queda de hoy y
     siguiendo hasta siete días. Más allá no hay nada que prometer. */
  for (let offset = 0; offset <= 7; offset += 1) {
    const fecha = sumarDias(hoy.fecha, offset);
    const dia = (hoy.dia + offset) % 7;
    const franjas = [...franjasDelDia(horario, fecha, dia)].sort(
      (a, b) => (parseHora(a.abre) ?? 0) - (parseHora(b.abre) ?? 0),
    );
    for (const franja of franjas) {
      const abre = parseHora(franja.abre);
      if (abre === null) continue;
      if (offset === 0 && abre < hoy.minutos) continue;
      return {
        abierto: false,
        sinHorario: false,
        cierraA: null,
        abreA: franja.abre,
        abreDia: dia,
        diasHastaApertura: offset,
        mensaje: excepcionHoy?.mensaje?.trim() || null,
      };
    }
  }

  return {
    abierto: false,
    sinHorario: false,
    cierraA: null,
    abreA: null,
    abreDia: null,
    diasHastaApertura: null,
    mensaje: excepcionHoy?.mensaje?.trim() || null,
  };
}

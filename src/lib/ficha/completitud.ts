/**
 * Cuánto le falta a la ficha. Módulo puro: lo usan el aviso de Hoy (en el
 * servidor, con la ficha guardada) y el indicador del editor (en el navegador,
 * con lo que el dueño está escribiendo).
 *
 * Cinco puntos, en el orden en que se le piden al dueño. Cada uno apunta a la
 * `FormSection` del editor que lo resuelve.
 */

export interface DatosCompletitud {
  logoUrl?: string | null;
  fotos: number;
  description?: string | null;
  tieneHorario: boolean;
  lat?: number | null;
  lng?: number | null;
  whatsapp?: string | null;
  phone?: string | null;
}

export interface PuntoFicha {
  ok: boolean;
  seccion: string;
  /** Lo que falta, dicho para el dueño. */
  falta: string;
  /** El nombre corto del punto, para el indicador. */
  nombre: string;
}

/** Una descripción de menos de esto no le dice nada a quien busca. */
export const MIN_DESCRIPCION = 30;

export function puntosFicha(d: DatosCompletitud): PuntoFicha[] {
  return [
    {
      ok: Boolean(d.logoUrl?.trim() || d.fotos > 0),
      seccion: "fotos",
      falta: "Faltan fotos o el logo",
      nombre: "Fotos",
    },
    {
      ok: (d.description ?? "").trim().length >= MIN_DESCRIPCION,
      seccion: "basico",
      falta: "Falta una descripción",
      nombre: "Descripción",
    },
    {
      ok: d.tieneHorario,
      seccion: "horario",
      falta: "Falta el horario",
      nombre: "Horario",
    },
    {
      ok: Boolean(d.lat && d.lng),
      seccion: "ubicacion",
      falta: "Falta marcarla en el mapa",
      nombre: "Ubicación",
    },
    {
      ok: Boolean(d.whatsapp?.trim() || d.phone?.trim()),
      seccion: "contacto",
      falta: "Falta un teléfono o WhatsApp",
      nombre: "Contacto",
    },
  ];
}

/** El porcentaje y el primer punto que falta, o `null` con la ficha completa. */
export function completitud(
  d: DatosCompletitud,
): { pct: number; seccion: string; falta: string } | null {
  const puntos = puntosFicha(d);
  const primero = puntos.find((p) => !p.ok);
  if (!primero) return null;
  const hechos = puntos.filter((p) => p.ok).length;
  return {
    pct: Math.round((hechos / puntos.length) * 100),
    seccion: primero.seccion,
    falta: primero.falta,
  };
}

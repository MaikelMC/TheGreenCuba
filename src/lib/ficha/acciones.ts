/**
 * Las acciones de la ficha: qué botones se pintan, en qué orden y cuáles se
 * caen cuando falta el dato que los hace posibles.
 *
 * El dueño elige el orden desde el panel, pero no puede prometer lo que no
 * tiene: sin teléfono no hay «Llamar», sin WhatsApp no hay «WhatsApp», sin
 * enlace de avisos no hay «Ofertas». La misma función filtra en el servidor y
 * en el navegador, y por eso vive aquí, pura y sin React.
 *
 * La barra fija nunca pinta una función de pago que no esté habilitada:
 * `pedidosHabilitado` y `reservaHabilitada` ya llegan resueltos del mapeo (plan
 * + interruptor + datos), así que este módulo no conoce los planes.
 */

export const ACCIONES_FICHA = [
  "como_llegar",
  "guardar",
  "llamar",
  "whatsapp",
  "compartir",
  "ofertas",
] as const;

export type AccionFicha = (typeof ACCIONES_FICHA)[number];

export const ACCIONES_BARRA = [
  "pedir",
  "reservar",
  "apartar",
  "cita",
  "como_llegar",
  "llamar",
  "whatsapp",
] as const;

export type AccionBarra = (typeof ACCIONES_BARRA)[number];

/** Cómo se llama cada acción en la ficha. */
export const ACCION_LABEL: Record<AccionFicha | AccionBarra, string> = {
  como_llegar: "Cómo llegar",
  guardar: "Guardar",
  llamar: "Llamar",
  whatsapp: "WhatsApp",
  compartir: "Compartir",
  ofertas: "Ofertas",
  pedir: "Pedir",
  reservar: "Reservar",
  apartar: "Apartar",
  cita: "Pedir cita",
};

/** El cupo de la fila y de la barra. Más botones no caben en un móvil. */
export const MAX_ACCIONES_FILA = 4;
export const MAX_ACCIONES_BARRA = 2;

/** Lo que el dueño guardó: el orden de la fila y las dos de la barra. */
export interface Acciones {
  fila: AccionFicha[];
  barra: AccionBarra[];
}

/**
 * Los datos que deciden si una acción se puede ofrecer.
 *
 * Todo opcional porque las fichas anteriores a esta función no tienen los
 * campos; `undefined` es «no lo dijo», y una acción sin dato no se pinta.
 */
export interface DatosAcciones {
  telefono?: string | null;
  whatsapp?: string | null;
  enlaceSeguidores?: string | null;
  pedidosHabilitado?: boolean;
  reservaHabilitada?: boolean;
  /** El tipo de reserva configurado; decide cuál de las tres se ofrece. */
  tipoReserva?: "mesa" | "apartado" | "cita";
}

function tieneTexto(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * ¿Hay datos suficientes para pintar esta acción?
 *
 * `guardar` y `compartir` son de plataforma y siempre están disponibles;
 * `como_llegar` también, porque `lat`/`lng` son `notNull` en la base.
 */
export function accionDisponible(
  accion: AccionFicha | AccionBarra,
  datos: DatosAcciones,
): boolean {
  switch (accion) {
    case "como_llegar":
    case "guardar":
    case "compartir":
      return true;
    case "llamar":
      return tieneTexto(datos.telefono);
    case "whatsapp":
      return tieneTexto(datos.whatsapp);
    case "ofertas":
      return tieneTexto(datos.enlaceSeguidores);
    case "pedir":
      return datos.pedidosHabilitado === true;
    case "reservar":
      return datos.reservaHabilitada === true && datos.tipoReserva === "mesa";
    case "apartar":
      return datos.reservaHabilitada === true && datos.tipoReserva === "apartado";
    case "cita":
      return datos.reservaHabilitada === true && datos.tipoReserva === "cita";
    default:
      return false;
  }
}

/** Quita repetidos conservando el orden. */
function unicos<T extends string>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

/**
 * La fila de acciones que se pinta: solo las disponibles, sin repetir y como
 * mucho `MAX_ACCIONES_FILA`.
 *
 * Si no hay configuración —ficha anterior a este campo— devuelve `[]`: el
 * llamador decide el respaldo, que no es asunto de este módulo.
 */
export function resolverFila(
  acciones: readonly AccionFicha[] | null | undefined,
  datos: DatosAcciones,
): AccionFicha[] {
  return unicos(acciones ?? [])
    .filter((accion) => accionDisponible(accion, datos))
    .slice(0, MAX_ACCIONES_FILA);
}

/** La barra fija: la principal y, como mucho, una secundaria. */
export function resolverBarra(
  acciones: readonly AccionBarra[] | null | undefined,
  datos: DatosAcciones,
): AccionBarra[] {
  return unicos(acciones ?? [])
    .filter((accion) => accionDisponible(accion, datos))
    .slice(0, MAX_ACCIONES_BARRA);
}

/** Las dos a la vez, ya filtradas. */
export function resolverAcciones(
  acciones: Acciones | null | undefined,
  datos: DatosAcciones,
): Acciones {
  return {
    fila: resolverFila(acciones?.fila, datos),
    barra: resolverBarra(acciones?.barra, datos),
  };
}

/** Valida una acción de la fila contra el catálogo. */
export function esAccionFicha(value: unknown): value is AccionFicha {
  return (
    typeof value === "string" &&
    (ACCIONES_FICHA as readonly string[]).includes(value)
  );
}

/** Valida una acción de la barra contra el catálogo. */
export function esAccionBarra(value: unknown): value is AccionBarra {
  return (
    typeof value === "string" &&
    (ACCIONES_BARRA as readonly string[]).includes(value)
  );
}

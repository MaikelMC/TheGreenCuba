/**
 * Reservas y apartados por WhatsApp: el formulario corto convertido en el
 * mensaje que recibe el negocio.
 *
 * Módulo puro a propósito —lo leen el navegador para armar el enlace, el panel
 * para enseñar la plantilla y las pruebas para comprobarlo— y separado del
 * componente porque el mensaje es la parte de la que responde el dueño: si sale
 * mal, le llega una reserva sin nombre o para un día que no era.
 *
 * **Sin backend.** La Verde no guarda la reserva, no la cobra y no la confirma:
 * lo único que hace es ordenar el mensaje y abrir WhatsApp. Quien confirma es el
 * negocio, por la misma conversación de siempre. El único rastro que queda es el
 * evento `click_reserva` que cuenta el botón, y ese es anónimo y agregado.
 */

import { whatsappHref } from "./contact-links";

/** Los tres tipos de reserva. El dueño elige uno y decide el botón y el formulario. */
export const TIPOS_RESERVA = ["mesa", "apartado", "cita"] as const;
export type TipoReserva = (typeof TIPOS_RESERVA)[number];

/** Valida en tiempo de ejecución lo que llega por HTTP. */
export function esTipoReserva(valor: unknown): valor is TipoReserva {
  return (
    typeof valor === "string" &&
    (TIPOS_RESERVA as readonly string[]).includes(valor)
  );
}

/** Cómo se llama cada tipo de cara a quien reserva. Es el texto del botón. */
export const RESERVA_LABEL: Record<TipoReserva, string> = {
  mesa: "Reservar mesa",
  apartado: "Apartar",
  cita: "Pedir cita",
};

/** Cuánto se puede pedir por adelantado. Más lejos, el negocio no puede prometer nada. */
export const DIAS_MAX_RESERVA = 30;

/**
 * La plantilla por defecto de cada tipo.
 *
 * Los huecos —`{nombre}`, `{fecha}`, `{hora}`, `{personas}`, `{producto}`,
 * `{cantidad}`— los rellena `mensajeReserva`. Se enseñan tal cual en el panel
 * para que el dueño sepa qué puede escribir en la suya.
 */
export const PLANTILLA_POR_DEFECTO: Record<TipoReserva, string> = {
  mesa: "¡Hola! Quiero reservar una mesa a nombre de {nombre} para el {fecha} a las {hora}, para {personas} personas.",
  apartado: "¡Hola! Quiero apartar {producto} x{cantidad} a nombre de {nombre} para el {fecha} a las {hora}.",
  cita: "¡Hola! Quiero pedir una cita a nombre de {nombre} para el {fecha} a las {hora}.",
};

/** La plantilla que se usa: la del dueño si escribió algo, si no la de su tipo. */
export function plantillaEfectiva(
  tipo: TipoReserva,
  custom?: string | null,
): string {
  const propia = custom?.trim();
  return propia ? propia : PLANTILLA_POR_DEFECTO[tipo];
}

/** Una opción de la carta para poder apartarla. */
export interface ProductoApartable {
  id: string;
  name: string;
}

/**
 * Lo configurado en el negocio que hace falta para pintar el botón.
 *
 * Lo construye el servidor —la ficha pública y el menú— una vez resuelto que la
 * función está activa, así que el componente de cliente no comprueba nada: si
 * esto llega, se pinta.
 */
export interface ReservaConfig {
  negocio: string;
  /** El número del negocio, tal como está guardado (`+53…`). */
  whatsapp: string;
  tipo: TipoReserva;
  /** Tope de personas por reserva. `null`/ausente = sin tope. Solo `mesa`. */
  aforoMaxPersonas?: number | null;
  /**
   * Cupo del día: personas que caben en total para una misma fecha.
   * `null`/ausente = sin tope, y el formulario no consulta ni bloquea nada.
   * Solo `mesa`, como el aforo por reserva.
   */
  capacidadDiaria?: number | null;
  /** Plantilla del dueño. `null`/vacía = la de por defecto. */
  plantilla?: string | null;
  /** La carta, para elegir qué apartar cuando el tipo es `apartado`. */
  productos: ProductoApartable[];
}

/**
 * Arma la configuración del botón a partir de la ficha.
 *
 * Vive aquí y no en cada página porque la usan las dos —la ficha pública y la
 * carta— y así no se separan: el filtro de «hay carta para apartar» y el `mesa`
 * por defecto tienen que decidirse igual en ambos sitios. Los campos llegan
 * estructurales y no como `UserPlace` para no crear una dependencia circular con
 * `places-store`, que importa `TipoReserva` de aquí.
 */
export function configReserva(fuente: {
  name: string;
  whatsapp?: string;
  reservaHabilitada?: boolean;
  tipoReserva?: TipoReserva;
  aforoMaxPersonas?: number | null;
  aforoDiarioPersonas?: number | null;
  plantillaReserva?: string | null;
  menu: readonly { id?: string; name: string }[];
}): ReservaConfig | undefined {
  if (!fuente.reservaHabilitada) return undefined;

  const tipo = fuente.tipoReserva ?? "mesa";
  const productos = fuente.menu
    .filter((item) => item.name.trim().length > 0)
    .map((item) => ({ id: item.id ?? item.name, name: item.name }));

  /* Un apartado sin carta no tiene nada que apartar, así que no se pinta el
     botón: mejor eso que uno que abre un formulario imposible de completar. */
  if (tipo === "apartado" && productos.length === 0) return undefined;

  return {
    negocio: fuente.name,
    whatsapp: fuente.whatsapp ?? "",
    tipo,
    aforoMaxPersonas: fuente.aforoMaxPersonas ?? null,
    capacidadDiaria: fuente.aforoDiarioPersonas ?? null,
    plantilla: fuente.plantillaReserva ?? null,
    productos,
  };
}

/**
 * Lo que recoge el formulario.
 *
 * `fecha` es `YYYY-MM-DD` —el `value` de un `<input type="date">`— y no un
 * `Date`: es lo que viaja por el `<input>` y lo que `mensajeReserva` formatea.
 */
export interface DatosReserva {
  nombre: string;
  fecha: string;
  hora: string;
  personas?: number;
  producto?: string;
  cantidad?: number;
  /** Nota libre para el negocio («voy con un coche», «sin cebolla»…). */
  nota?: string;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * `2026-10-15` → `15 de octubre, 2026`.
 *
 * A mano y no con `toLocaleDateString`: el mensaje tiene que salir igual en el
 * navegador, en el servidor y en las pruebas, sin depender de si el runtime
 * trae los datos de locale.
 */
export function formatearFechaReserva(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
  if (!m) return fecha.trim();
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return fecha.trim();
  return `${Number(m[3])} de ${mes}, ${m[1]}`;
}

/** El inicio del día local de `hoy`, en ms de UTC. Es el «hoy» contra el que se compara. */
function inicioDelDia(hoy: Date): number {
  return Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
}

/** Una fecha en su día local, «YYYY-MM-DD»: el `value` de un `<input type="date">`. */
export function fechaLocalIso(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** `YYYY-MM-DD` → ms a las 00:00 UTC, o `null` si no es una fecha real. */
function fechaEnMs(fecha: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const ms = Date.UTC(y, mm - 1, dd);
  const d = new Date(ms);
  /* `Date.UTC(2026, 1, 31)` no falla: rueda al 3 de marzo. Sin esta vuelta a
     comprobar, un 31 de febrero se aceptaba y el mensaje salía con otra fecha. */
  if (
    d.getUTCFullYear() !== y ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  ) {
    return null;
  }
  return ms;
}

/**
 * ¿Cabe esta gente en lo que queda del día? `null` = sí.
 *
 * Vive aquí, suelto, porque lo preguntan **dos** veces y con el mismo texto: el
 * formulario en cada tecla —para avisar en el momento y no al enviar— y la
 * validación del envío. Con la frase en un solo sitio, el aviso en vivo y el
 * error del envío no pueden decir cosas distintas.
 *
 * Una capacidad `null`, `0` o negativa se lee como «sin cupo configurado»: el
 * `null` es del dueño que no lo puso, y el `0` no es «no cabe nadie» sino un
 * campo vacío que llegó hasta aquí. Sin cupo no hay nada que comprobar.
 */
export function avisoCupo(
  personas: number,
  ocupadas: number,
  capacidad?: number | null,
): string | null {
  if (typeof capacidad !== "number" || capacidad <= 0) return null;
  const restantes = Math.max(0, capacidad - ocupadas);
  if (personas <= restantes) return null;
  if (restantes === 0) return "Ese día ya no hay espacio.";
  return `Ese día solo quedan ${restantes} ${restantes === 1 ? "plaza" : "plazas"}.`;
}

/**
 * `null` si la fecha es reservable; el error, si no.
 *
 * Es la comprobación de `validarReserva` sobre la fecha, sacada aparte porque
 * la ruta del servidor necesita **exactamente esto** sin el resto del
 * formulario: el servidor no ve `DatosReserva`, solo una fecha que le llegó por
 * HTTP. `margenDias` deja pasar un día por delante para absorber el desfase
 * entre la fecha local del cliente —Cuba va por detrás de UTC— y el «hoy» del
 * servidor; sin él, quien reservara a las 20:00 hora local podía ver rechazado
 * el mismo día que el formulario le ofrecía.
 */
export function errorFechaReserva(
  fecha: string,
  hoy: Date = new Date(),
  margenDias = 0,
): string | null {
  const ms = fechaEnMs(fecha);
  if (ms === null) return "Elige la fecha de la reserva.";

  const inicio = inicioDelDia(hoy);
  if (ms < inicio - margenDias * 86_400_000) {
    return "La fecha no puede ser en el pasado.";
  }
  if (ms > inicio + (DIAS_MAX_RESERVA + margenDias) * 86_400_000) {
    return `Solo puedes reservar con ${DIAS_MAX_RESERVA} días de antelación como máximo.`;
  }
  return null;
}

/**
 * El primer error del formulario, o `null` si está bien.
 *
 * Se devuelve el mensaje y no un booleano porque cada caso pide una frase
 * distinta, y aquí es donde se sabe cuál. La fecha no puede ser pasada ni
 * quedar a más de `DIAS_MAX_RESERVA` días.
 *
 * `cupo` es lo que va ocupado el día elegido y el tope del local, ya leídos. Va
 * como objeto y no como dos números sueltos para que se lea en la llamada qué
 * es cada cosa, y porque los dos salen siempre juntos —uno sin el otro no dice
 * nada—. Sin cupo configurado, ausente.
 */
export function validarReserva(
  datos: DatosReserva,
  tipo: TipoReserva,
  hoy: Date = new Date(),
  aforoMaxPersonas?: number | null,
  cupo?: { ocupadas: number; capacidad?: number | null },
): string | null {
  if (!datos.nombre.trim()) return "Escribe tu nombre.";

  const falloFecha = errorFechaReserva(datos.fecha, hoy);
  if (falloFecha) return falloFecha;

  if (!datos.hora.trim()) return "Elige la hora.";

  if (tipo === "mesa") {
    const personas = datos.personas;
    if (!Number.isInteger(personas) || (personas ?? 0) < 1) {
      return "¿Para cuántas personas?";
    }
    if (
      typeof aforoMaxPersonas === "number" &&
      aforoMaxPersonas > 0 &&
      (personas ?? 0) > aforoMaxPersonas
    ) {
      return `Este negocio admite hasta ${aforoMaxPersonas} personas por reserva.`;
    }

    /* El cupo va **después** del aforo a propósito: si el grupo no cabe ni en
       una mesa vacía, «hasta 8 personas por reserva» dice más que «quedan 3
       plazas», que haría pensar que con menos gente sí. */
    if (cupo) {
      const aviso = avisoCupo(personas ?? 0, cupo.ocupadas, cupo.capacidad);
      if (aviso) return aviso;
    }
  }

  if (tipo === "apartado") {
    if (!datos.producto?.trim()) return "Elige qué quieres apartar.";
    const cantidad = datos.cantidad;
    if (!Number.isInteger(cantidad) || (cantidad ?? 0) < 1) {
      return "¿Cuántos quieres apartar?";
    }
  }

  return null;
}

/**
 * El texto que se le manda al negocio.
 *
 * Se escribe como se leería en WhatsApp —`*` para la negrita—, abre con el
 * nombre del negocio y cierra con «Reserva desde La Verde», que es lo que le
 * dice al dueño por dónde le entró la reserva. La nota va en su propia línea y
 * fuera de la plantilla: es texto libre de quien reserva, no algo que el dueño
 * configure.
 */
export function mensajeReserva({
  negocio,
  tipo,
  plantilla,
  datos,
}: {
  negocio: string;
  tipo: TipoReserva;
  plantilla?: string | null;
  datos: DatosReserva;
}): string {
  const reemplazos: Record<string, string> = {
    nombre: datos.nombre.trim(),
    fecha: formatearFechaReserva(datos.fecha),
    hora: datos.hora.trim(),
    personas: datos.personas ? String(datos.personas) : "",
    producto: datos.producto?.trim() ?? "",
    cantidad: datos.cantidad ? String(datos.cantidad) : "",
  };

  /* Un hueco desconocido se deja tal cual en vez de borrarse: si el dueño
     escribe una llave de más, la ve en el mensaje y la corrige, en lugar de
     quedarse con un hueco que desapareció sin decir nada. */
  const cuerpo = plantillaEfectiva(tipo, plantilla).replace(
    /\{(\w+)\}/g,
    (todo, clave: string) => reemplazos[clave] ?? todo,
  );

  const partes = [`*Reserva — ${negocio}*`, "", cuerpo];

  const nota = datos.nota?.trim();
  if (nota) partes.push("", `Nota: ${nota}`);

  partes.push("", "Reserva desde La Verde");
  return partes.join("\n");
}

/** `https://wa.me/<número>?text=<mensaje>` — la URL que abre WhatsApp. */
export function hrefReserva(whatsapp: string, mensaje: string): string {
  const base = whatsappHref(whatsapp);
  return base ? `${base}?text=${encodeURIComponent(mensaje)}` : "";
}

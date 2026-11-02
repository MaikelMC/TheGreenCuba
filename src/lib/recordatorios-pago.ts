import {
  CATALOGO,
  type Catalogo,
  type ClaveModulo,
  type Funcion,
} from "@/lib/plans";
import { formatDate } from "@/lib/utils";

/**
 * Cuándo hay que recordar el pago del mes y qué se dice.
 *
 * Es puro porque lo usan dos relojes distintos: el trabajo diario, que decide a
 * quién le toca, y las pruebas, que fijan `ahora` a mano. Y porque el mismo
 * texto se manda por tres sitios —el push, el correo y la bandeja—, así que la
 * redacción no puede vivir dentro de la ruta que la envía.
 *
 * **Tres momentos, no uno.** Cinco días antes se avisa con margen; el día antes,
 * porque es el último; y al día siguiente del vencimiento, cuando ya no renovó.
 * Los tres hablan de la misma fecha de pago, así que la clave de idempotencia es
 * (negocio, fecha, momento): un pago que se corre un mes no hereda los avisos
 * del mes anterior.
 */

export type EtapaPago = "proximo" | "vispera" | "vencido";

/** Días antes del vencimiento en que empieza el primer aviso. */
export const DIAS_AVISO_PAGO = 5;

/**
 * Hasta cuántos días después se sigue diciendo «no renovaste».
 *
 * El caso normal es el día siguiente al vencimiento, pero un cron que falle una
 * noche dejaría a todo el mundo sin el aviso más importante. Se dan tres días de
 * margen y **una sola vez**: repetirlo cada mañana sería acoso, no un aviso.
 */
export const DIAS_GRACIA_VENCIDO = 3;

const DIA_MS = 86_400_000;

/* La fecha de pago se lee en el calendario cubano, no en el del servidor. Un
   `vence_en` guardado a las 00:00 de La Habana es, en UTC, la madrugada del día
   siguiente; contar por UTC adelantaría el aviso un día entero. `en-CA` da el
   formato `YYYY-MM-DD`, que se parte sin ambigüedad. */
const FORMATO_CUBA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Havana",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function diaEnCuba(fecha: Date): number {
  const partes = FORMATO_CUBA.format(fecha).split("-").map(Number);
  const [anio, mes, dia] = partes;
  if (!anio || !mes || !dia) return Math.floor(fecha.getTime() / DIA_MS);
  return Date.UTC(anio, mes - 1, dia) / DIA_MS;
}

/**
 * Días que faltan para la fecha de pago: `5` es dentro de cinco días, `0` es hoy
 * y `-1` es que venció ayer.
 *
 * Se comparan días de calendario y no milisegundos: un vencimiento a las 23:59
 * de hoy no es «mañana», y una diferencia de horas no puede mover el aviso de
 * día.
 */
export function diasHastaPago(
  fechaPago: Date,
  ahora: Date = new Date(),
): number {
  return diaEnCuba(fechaPago) - diaEnCuba(ahora);
}

/**
 * Qué toca decir hoy, si es que toca algo.
 *
 * El día del vencimiento no se avisa: el correo del día anterior ya lo dijo y el
 * del día siguiente vuelve a hablar de esa misma fecha. Dos correos el mismo día
 * se leen como un error; el silencio de la fecha exacta se entiende como «hoy es
 * el día».
 */
export function etapaDePago(dias: number): EtapaPago | null {
  if (dias === 1) return "vispera";
  if (dias >= 2 && dias <= DIAS_AVISO_PAGO) return "proximo";
  if (dias <= -1 && dias >= -DIAS_GRACIA_VENCIDO) return "vencido";
  return null;
}

/**
 * Los servicios que todavía no tiene, en el orden en que conviene enseñarlos.
 *
 * Se recorre el catálogo de módulos sueltos —los más baratos primero— y se
 * propone **la entrada más barata que abra algo nuevo**: un negocio con Pro no
 * debe recibir el consejo de contratar lo que ya tiene, y uno en Gratis no
 * necesita leer tres veces el mismo catálogo. Se enseña un módulo por nombre y
 * una función concreta, que es lo que se recuerda.
 */
export function sugerenciasParaProbar(
  funciones: ReadonlySet<Funcion>,
  cat: Catalogo = CATALOGO,
  max = 2,
): string[] {
  const claves = (Object.keys(cat.modulos) as ClaveModulo[]).sort(
    (a, b) => cat.modulos[a].usd - cat.modulos[b].usd,
  );

  const sugerencias: string[] = [];
  for (const clave of claves) {
    if (sugerencias.length >= max) break;

    const modulo = cat.modulos[clave];
    const nuevas = modulo.funciones.filter(
      (funcion) => !funciones.has(funcion) && cat.funciones[funcion].disponible,
    );
    const [primera] = nuevas;
    if (!primera) continue;

    sugerencias.push(
      `${modulo.nombre} (${modulo.usd} USD/mes): ${cat.funciones[primera].texto.toLowerCase()}`,
    );
  }

  return sugerencias;
}

export interface DatosRecordatorio {
  /** El nombre del negocio, tal como lo verá el dueño. */
  negocio: string;
  /** «Pro», «Gratis», o «Pro (en prueba)». */
  plan: string;
  /** `null` en la prueba: todavía no hay un precio contratado que recordar. */
  precioUsd: number | null;
  fechaPago: Date;
  etapa: EtapaPago;
  /** Lo que puede probar este mes. Vacío si ya lo tiene todo. */
  sugerencias: readonly string[];
  /** Para nombrar el día sin depender del reloj del que lee. */
  ahora?: Date;
}

export interface AvisoDePago {
  /** El asunto del correo. */
  asunto: string;
  /** La fecha del pago, ya formateada para la cabecera del correo. */
  fecha: string;
  /** El push: dos líneas, recortadas por `push-server`. */
  push: { title: string; body: string };
  /** El correo. */
  titular: string;
  saludo: string;
  parrafos: string[];
  sugerencias: string[];
  ctaTexto: string;
}

/** «10 nov» y, si el año cambia, «10 nov 2027». */
function fecha(fechaPago: Date, ahora: Date): string {
  return formatDate(fechaPago, ahora);
}

/**
 * El texto de cada momento.
 *
 * Los tres comparten la misma estructura —qué negocio, qué plan, qué fecha— y
 * cambian el tono: el primero informa, el segundo apura y el tercero cuenta lo
 * que se apagó. Los tres cierran invitando a estrenar algo del catálogo, porque
 * el aviso del mes es también el momento en que el dueño decide qué contrata.
 */
export function avisoDePago(datos: DatosRecordatorio): AvisoDePago {
  const ahora = datos.ahora ?? new Date();
  const dia = fecha(datos.fechaPago, ahora);
  const precio =
    datos.precioUsd === null ? "" : ` Son ${datos.precioUsd} USD al mes.`;

  /* Un negocio con Pro ya tiene todo el catálogo, así que no hay módulo que
     proponerle. Se le invita a estrenar lo que paga, que es lo que de verdad le
     queda por hacer este mes. */
  const sugerencias =
    datos.sugerencias.length > 0
      ? [...datos.sugerencias]
      : [
          "Ya tienes todo el catálogo activo: este mes estrena una oferta flash o actualiza tu carta desde Telegram.",
        ];

  if (datos.etapa === "proximo") {
    const dias = diasHastaPago(datos.fechaPago, ahora);
    const cuando = dias === 1 ? "mañana" : `en ${dias} días`;

    return {
      asunto: `Tu plan ${datos.plan} de «${datos.negocio}» se renueva ${cuando}`,
      fecha: dia,
      push: {
        title: `Pago de ${datos.plan} ${cuando}`,
        body: `«${datos.negocio}»: ${dia}.${precio}`,
      },
      titular: `Tu plan ${datos.plan} se renueva ${cuando}`,
      saludo: `El plan ${datos.plan} de «${datos.negocio}» está pagado hasta el ${dia}.${precio}`,
      parrafos: [
        `Renueva antes del ${dia} para que el negocio no pierda ninguna de las funciones que tienes activas.`,
        "Cada mes es también una oportunidad de probar algo nuevo: lo que sumes ahora se queda en tu ficha desde el primer día.",
      ],
      sugerencias,
      ctaTexto: "Renovar y ver planes",
    };
  }

  if (datos.etapa === "vispera") {
    return {
      asunto: `Mañana vence el plan ${datos.plan} de «${datos.negocio}»`,
      fecha: dia,
      push: {
        title: `Mañana vence tu plan ${datos.plan}`,
        body: `«${datos.negocio}»: último día para renovar (${dia}).`,
      },
      titular: "Mañana es el último día",
      saludo: `El plan ${datos.plan} de «${datos.negocio}» vence mañana, ${dia}.${precio}`,
      parrafos: [
        "Si no lo renuevas, el negocio vuelve al plan Gratis y se apagan las funciones de pago: ofertas, avisos a seguidores, publicaciones de Facebook y el resto del plan.",
        "Aprovecha el nuevo mes para añadir una función que todavía no tengas. Se activa en cuanto renuevas, sin esperar a nada más.",
      ],
      sugerencias,
      ctaTexto: "Renovar ahora",
    };
  }

  return {
    asunto: `El plan ${datos.plan} de «${datos.negocio}» no se renovó`,
    fecha: dia,
    push: {
      title: `No renovaste el plan ${datos.plan}`,
      body: `«${datos.negocio}» venció el ${dia} y pasó al plan Gratis. Reactívalo cuando quieras.`,
    },
    titular: "Tu plan no se renovó",
    saludo: `El plan ${datos.plan} de «${datos.negocio}» venció el ${dia} y no registramos la renovación.`,
    parrafos: [
      "El negocio sigue publicado en La Verde, pero vuelve al plan Gratis y las funciones de pago quedaron apagadas. No se perdió nada de lo que habías escrito: todo vuelve a aparecer en cuanto reactivas el plan.",
      "Si ya pagaste, ignora este aviso: el pago puede tardar un rato en reflejarse. Y si este mes quieres cambiar de plan, este es el momento de mirar qué más puedes activar.",
    ],
    sugerencias,
    ctaTexto: "Reactivar mi plan",
  };
}

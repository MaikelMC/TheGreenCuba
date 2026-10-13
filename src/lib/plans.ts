/**
 * Planes, módulos y permisos: la **única** fuente de verdad.
 *
 * Este archivo es puro a propósito —no importa la base de datos— porque lo leen
 * los dos lados: el servidor para decidir qué se permite, y el navegador para
 * pintar el candado sobre lo que no. Si el mapa viviera en dos sitios, el día
 * que uno cambie el otro seguiría enseñando una cerradura que ya no
 * corresponde, o —peor— dejaría de enseñarla sobre algo que sí está cerrado.
 *
 * El modelo tiene **tres piezas**, no una escalera de planes:
 *
 * - **Gratis**: lo que ya tiene cualquiera que aparezca en La Verde.
 * - **Módulos sueltos**: cada uno se contrata por su cuenta y trae sus
 *   funciones. Se pagan al mes y cada uno tiene su propia vigencia.
 * - **Packs**: varios módulos juntos con descuento. `pro` es el paquete
 *   completo —Esencial + Publicidad Max + asistente— más lo exclusivo de Pro.
 *
 * Un pack y un módulo no se excluyen: un negocio puede tener Esencial y además
 * contratar Facebook o el asistente suelto. La función entra si **cualquiera**
 * de las piezas contratadas la trae.
 *
 * La regla que gobierna todo esto: **un plan no borra datos**. Bajar de plan
 * solo deja de permitir y de enseñar; lo que el negocio ya escribió se queda
 * donde está y vuelve a aparecer si vuelve a subir.
 *
 * ── El catálogo ──────────────────────────────────────────────────────────────
 *
 * Lo que sigue son los **valores por defecto** de todo esto —precios, nombres,
 * lemas, textos, qué funciones trae cada pieza—. Viven aquí en código y
 * `CATALOGO` los expone como un objeto plano; la administración puede pisarlos
 * desde `/admin/planes` y lo que llega entonces es ese mismo objeto con los
 * campos cambiados (`src/lib/catalogo-server.ts`).
 *
 * Lo que **no** se puede pisar son las **claves**: `Funcion`, `ClaveModulo` y
 * `Pack` siguen siendo uniones literales derivadas de estos literales, porque
 * cada clave tiene código detrás (`qr_sin_marca` existe porque hay una consulta
 * que la mira). Solo se editan sus valores.
 *
 * Todas las funciones puras reciben el catálogo como **último parámetro con
 * valor por defecto `CATALOGO`**, así que quien no lo pase sigue leyendo el de
 * por defecto y no hay que tocar ni una llamada para que compile.
 */

/* ── Las funciones ──────────────────────────────────────────────────────────
   El catálogo entero, cada una con su texto —para el dueño— y su bandera
   `disponible`. Una función con `disponible: false` se sigue enseñando en la
   tarjeta, con la etiqueta «Próximamente»: se vende desde ya, pero el candado
   no se abre hasta que exista de verdad. */

export const FUNCIONES = {
  /* Gratis: lo que ya tiene cualquiera que aparezca en La Verde. */
  pin: { texto: "Tu pin en el mapa de La Verde", disponible: true },
  perfil: {
    texto: "Ficha completa: fotos, contactos y horario",
    disponible: true,
  },
  menu_qr: {
    texto: "Menú completo con QR, con la marca «Encuéntranos en La Verde»",
    disponible: true,
  },
  fotos_productos: { texto: "Fotos en tus productos y servicios", disponible: true },
  busqueda_ia: {
    texto: "Te encuentran buscando con sus propias palabras",
    disponible: true,
  },
  energia_respaldo: {
    texto: "Etiqueta de energía de respaldo (planta o inversor)",
    disponible: true,
  },
  stats_resumen: { texto: "Contador de visitas del mes", disponible: true },

  /* Menú Pro. */
  qr_sin_marca: {
    texto: "Tu QR con tu nombre y sin la marca de La Verde",
    disponible: true,
  },
  fotos_ilimitadas: {
    texto: "Fotos ilimitadas en tus productos y servicios",
    disponible: true,
  },
  hoy_hay: { texto: "«Hoy hay»: marca lo agotado o lo disponible", disponible: true },

  /* Pedidos y reservas. */
  whatsapp_pedido: { texto: "Pedir por WhatsApp desde tu ficha", disponible: true },
  reservas_whatsapp: {
    texto: "Reservas y apartados por WhatsApp",
    disponible: true,
  },

  /* Visibilidad. */
  verificado: { texto: "Sello de negocio verificado", disponible: true },
  prioridad_ia: {
    texto: "Prioridad en las recomendaciones con IA",
    disponible: true,
  },
  stats_basicas: { texto: "Estadísticas de visitas y llamadas", disponible: true },

  /* Facebook. La segunda es el mismo permiso con otro ritmo: quien tiene tres a
     la semana publica igual que quien tiene una, así que la trae también, y lo
     que cambia es el tope. Se enseña una sola vez —ver `ListaFunciones`—. */
  publicaciones_fb: {
    texto: "Publicaciones semanales en grupos de Facebook",
    disponible: true,
  },
  publicaciones_fb_3: {
    texto: "Publicaciones tres veces por semana en grupos de Facebook",
    disponible: true,
  },

  /* Eventos. Todavía no existe: se enseña con «Próximamente». */
  eventos: { texto: "Crea y promociona tus eventos", disponible: false },

  /* Marketing activo. */
  flyers: { texto: "Flyers automáticos, hasta 10 al mes", disponible: false },
  ofertas_flash: { texto: "Ofertas flash con cuenta atrás", disponible: true },
  seguidores: { texto: "Avisos a tus seguidores", disponible: true },

  /* Asistente. */
  asistente_ia: {
    texto: "Asistente de IA en Telegram: edita tu menú y consulta tus datos",
    disponible: true,
  },

  /* Exclusivo de Pro. */
  ranking: { texto: "Ranking mensual con descuento", disponible: true },
  stats_completas: {
    texto: "Estadísticas completas y comparativas",
    disponible: true,
  },
  soporte_prioritario: {
    texto: "Soporte prioritario por WhatsApp",
    disponible: true,
  },

  /* Bonos de Publicidad Max. Se venden con el pack; todavía no existen. */
  destacado_semana: {
    texto: "«Destacado de la semana» en el inicio",
    disponible: false,
  },
  cupones_whatsapp: { texto: "Cupones por WhatsApp", disponible: false },
  reporte_mensual: {
    texto: "Reporte mensual de resultados",
    disponible: false,
  },
} as const satisfies Record<string, { texto: string; disponible: boolean }>;

/** Cualquier función del catálogo. */
export type Funcion = keyof typeof FUNCIONES;

/** Lo que ya tiene cualquiera que aparezca en La Verde. */
export const GRATIS: readonly Funcion[] = [
  "pin",
  "perfil",
  "menu_qr",
  "fotos_productos",
  "busqueda_ia",
  "energia_respaldo",
  "stats_resumen",
];

/* ── Los módulos sueltos ────────────────────────────────────────────────────
   Cada uno con su precio y sus funciones. Se contrata uno a uno y no dependen
   entre ellos: nada de «para tener X hace falta Y». */

export const MODULOS = {
  menu_pro: {
    nombre: "Menú Pro",
    lema: "Tu carta, sin nuestra marca.",
    texto:
      "Tu QR deja de llevar el sello de La Verde y pasa a llevar el tuyo, con las fotos sin tope y el «Hoy hay» para lo que se acaba.",
    usd: 1,
    funciones: ["qr_sin_marca", "fotos_ilimitadas", "hoy_hay"],
  },
  pedidos_reservas: {
    nombre: "Pedidos y reservas",
    lema: "Que te pidan sin preguntar.",
    texto:
      "Un botón en tu ficha para pedir y para reservar por WhatsApp, con el mensaje ya redactado.",
    usd: 1.5,
    funciones: ["whatsapp_pedido", "reservas_whatsapp"],
  },
  visibilidad: {
    nombre: "Visibilidad",
    lema: "Que te elijan antes que al de al lado.",
    texto:
      "El sello de verificado, prioridad cuando alguien busca con IA, y las visitas y llamadas de la semana contadas.",
    usd: 2,
    funciones: ["verificado", "prioridad_ia", "stats_basicas"],
  },
  facebook: {
    nombre: "Facebook",
    lema: "Tu negocio en los grupos de tu zona.",
    texto: "Una publicación a la semana en los grupos de Facebook de tu municipio, redactada con IA.",
    usd: 3,
    funciones: ["publicaciones_fb"],
  },
  facebook_3: {
    nombre: "Facebook ×3",
    lema: "Tres veces más veces visto.",
    texto: "Lo mismo que Facebook, pero tres publicaciones a la semana en vez de una.",
    usd: 5,
    funciones: ["publicaciones_fb", "publicaciones_fb_3"],
  },
  eventos: {
    nombre: "Eventos",
    lema: "Llena lo que montes.",
    texto: "Crea tus eventos y promociónalos en La Verde, con fecha, lugar y aviso a quien te sigue.",
    usd: 3,
    funciones: ["eventos"],
  },
  marketing_activo: {
    nombre: "Marketing activo",
    lema: "Que se enteren y vuelvan.",
    texto:
      "Flyers listos para repartir, ofertas flash con cuenta atrás y avisos a tus seguidores.",
    usd: 3,
    funciones: ["flyers", "ofertas_flash", "seguidores"],
  },
  asistente_telegram: {
    nombre: "Asistente en Telegram",
    lema: "Tu menú, desde el móvil, hablando.",
    texto:
      "Un asistente con IA en Telegram para editar tu menú y tu perfil y preguntarle cómo va el mes.",
    usd: 3,
    funciones: ["asistente_ia"],
  },
} as const satisfies Record<
  string,
  { nombre: string; lema: string; texto: string; usd: number; funciones: readonly Funcion[] }
>;

export type ClaveModulo = keyof typeof MODULOS;

/** Las funciones de un conjunto de módulos, sin repetir. */
function funcionesDeModulos(
  claves: readonly ClaveModulo[],
  modulos: Record<ClaveModulo, { funciones: readonly Funcion[] }> = MODULOS,
): Funcion[] {
  return [...new Set(claves.flatMap((c) => [...modulos[c].funciones]))];
}

/* ── Los packs ──────────────────────────────────────────────────────────────
   Varios módulos juntos con descuento. `pro` es la suma de los otros dos más
   el asistente y lo exclusivo de Pro: por eso se escriben por composición y no
   repitiendo listas, que se desincronizan al primer cambio.

   Un pack se describe por lo que **incluye** —módulos— y por sus **bonos**
   —funciones sueltas que no son de ningún módulo—. Sus `funciones` se calculan
   de ahí: es lo que impide que `incluye` y `funciones` digan cosas distintas
   cuando alguien edita una sin la otra. */

const ESENCIAL_MODULOS = ["menu_pro", "pedidos_reservas", "visibilidad"] as const;
/* Publicidad Max lleva Facebook **×3**: es el ritmo que se vendió con el pack. */
const PUBLICIDAD_MODULOS = ["facebook_3", "eventos", "marketing_activo"] as const;

/** Los bonos que van con Publicidad Max, además de sus módulos. */
const BONOS_PUBLICIDAD: readonly Funcion[] = [
  "destacado_semana",
  "cupones_whatsapp",
  "reporte_mensual",
];

/** Las funciones de un pack: las de sus módulos más sus bonos, sin repetir. */
export function funcionesDePack(
  incluye: readonly ClaveModulo[],
  bonos: readonly Funcion[],
  modulos: Record<ClaveModulo, { funciones: readonly Funcion[] }> = MODULOS,
): Funcion[] {
  return [...new Set([...funcionesDeModulos(incluye, modulos), ...bonos])];
}

export const PACKS = {
  esencial: {
    nombre: "Esencial",
    lema: "Para vender sin perder clientes.",
    texto: "Menú Pro, pedidos y reservas, y visibilidad. Todo lo que hace falta para cobrar por lo que ya tienes.",
    usd: 3.5,
    incluye: ESENCIAL_MODULOS,
    bonos: [],
    funciones: funcionesDePack(ESENCIAL_MODULOS, []),
  },
  publicidad_max: {
    nombre: "Publicidad Max",
    lema: "Para que te vean.",
    texto:
      "Facebook tres veces por semana, eventos y marketing activo, más los bonos: destacado de la semana, cupones y reporte mensual.",
    usd: 6,
    incluye: PUBLICIDAD_MODULOS,
    bonos: BONOS_PUBLICIDAD,
    funciones: funcionesDePack(PUBLICIDAD_MODULOS, BONOS_PUBLICIDAD),
  },
  pro: {
    nombre: "Pro",
    lema: "Todo, sin depender de nadie.",
    texto:
      "Esencial y Publicidad Max con sus bonos, el asistente en Telegram, el ranking con descuento y las estadísticas completas.",
    usd: 10,
    incluye: [...ESENCIAL_MODULOS, ...PUBLICIDAD_MODULOS, "asistente_telegram"] as const,
    bonos: [...BONOS_PUBLICIDAD, "ranking", "stats_completas", "soporte_prioritario"] as const,
    funciones: funcionesDePack(
      [...ESENCIAL_MODULOS, ...PUBLICIDAD_MODULOS, "asistente_telegram"],
      [...BONOS_PUBLICIDAD, "ranking", "stats_completas", "soporte_prioritario"],
    ),
  },
} as const satisfies Record<
  string,
  {
    nombre: string;
    lema: string;
    texto: string;
    usd: number;
    incluye: readonly ClaveModulo[];
    bonos: readonly Funcion[];
    funciones: readonly Funcion[];
  }
>;

export type Pack = keyof typeof PACKS;

/** `gratis` no es un pack contratado: es la ausencia de pack. */
export type Plan = "gratis" | Pack;

/** Los cuatro estados posibles, de menor a mayor. El orden se usa para comparar. */
export const PLAN_ORDER: readonly Plan[] = [
  "gratis",
  "esencial",
  "publicidad_max",
  "pro",
];

/** Los tres packs, en orden, para las tarjetas. */
export const PACKS_ORDER: readonly Pack[] = ["esencial", "publicidad_max", "pro"];

/* ── La tasa del CUP ────────────────────────────────────────────────────────
   Los precios están acordados en dólares y el CUP se calcula, nunca se escribe
   a mano en cada tarjeta. Una sola constante; cambiarla cambia las tres
   tarjetas a la vez. */

/** Pesos cubanos por dólar, por defecto. El valor vivo sale del catálogo. */
export const TASA_CUP = 780;

/* ── El catálogo ────────────────────────────────────────────────────────────
   Todo lo anterior como un objeto plano, que es lo que se puede pisar desde
   `/admin/planes`. Cada campo es un `Record` de claves fijas: el admin cambia
   valores, nunca añade claves. */

export interface FuncionCatalogo {
  texto: string;
  disponible: boolean;
}

export interface ModuloCatalogo {
  nombre: string;
  lema: string;
  texto: string;
  usd: number;
  funciones: readonly Funcion[];
}

export interface PackCatalogo {
  nombre: string;
  lema: string;
  texto: string;
  usd: number;
  incluye: readonly ClaveModulo[];
  bonos: readonly Funcion[];
  /** Derivado de `incluye` + `bonos`. No se edita: se recalcula al leer. */
  funciones: readonly Funcion[];
}

export interface Catalogo {
  /** Pesos cubanos por dólar. */
  tasaCup: number;
  /** El nombre y el lema de la pieza Gratis, que no es un pack. */
  gratisNombre: string;
  gratisLema: string;
  gratis: readonly Funcion[];
  funciones: Record<Funcion, FuncionCatalogo>;
  modulos: Record<ClaveModulo, ModuloCatalogo>;
  packs: Record<Pack, PackCatalogo>;
}

/** El catálogo de fábrica. Es el que se lee cuando no hay nada guardado. */
export const CATALOGO: Catalogo = {
  tasaCup: TASA_CUP,
  gratisNombre: "Gratis",
  gratisLema: "Para que te encuentren.",
  gratis: GRATIS,
  funciones: FUNCIONES,
  modulos: MODULOS,
  packs: PACKS,
};

/* ── Lectura del catálogo ─────────────────────────────────────────────────── */

/** ¿Se puede usar ya, o es un cartel de «Próximamente»? */
export function esDisponible(funcion: Funcion, cat: Catalogo = CATALOGO): boolean {
  return cat.funciones[funcion].disponible;
}

/** El nombre de un plan de cara al dueño. `gratis` no es un pack. */
export function nombreDe(plan: Plan, cat: Catalogo = CATALOGO): string {
  return plan === "gratis" ? cat.gratisNombre : cat.packs[plan].nombre;
}

/** El titular de la tarjeta de un plan. */
export function lemaDe(plan: Plan, cat: Catalogo = CATALOGO): string {
  return plan === "gratis" ? cat.gratisLema : cat.packs[plan].lema;
}

/** El precio mensual en USD. `0` es gratis. */
export function usdDe(plan: Plan, cat: Catalogo = CATALOGO): number {
  return plan === "gratis" ? 0 : cat.packs[plan].usd;
}

/** El precio en CUP, redondeado a la decena. Con 780 cae exacto en todos. */
export function cupDe(usd: number, cat: Catalogo = CATALOGO): number {
  return Math.round((usd * cat.tasaCup) / 10) * 10;
}

/** «1.560 CUP», con el separador de miles cubano. */
export function textoCup(usd: number, cat: Catalogo = CATALOGO): string {
  return `${cupDe(usd, cat).toLocaleString("es-CU")} CUP`;
}

/* ── Quién abre cada función ────────────────────────────────────────────────
   Para el candado. Una función puede estar en varios sitios —`whatsapp_pedido`
   está en el módulo Pedidos y en los packs—, así que se nombra **la vía más
   barata** de conseguirla: primero los módulos sueltos, por precio, y si no,
   el pack más barato que la traiga. */

/** El módulo más barato que trae esta función, o `null` si solo la trae un pack. */
export function moduloDe(funcion: Funcion, cat: Catalogo = CATALOGO): ClaveModulo | null {
  const porPrecio = (Object.keys(cat.modulos) as ClaveModulo[]).sort(
    (a, b) => cat.modulos[a].usd - cat.modulos[b].usd,
  );
  return porPrecio.find((c) => cat.modulos[c].funciones.includes(funcion)) ?? null;
}

/** El pack más barato que trae esta función, o `null` si ya es de Gratis. */
export function packDe(funcion: Funcion, cat: Catalogo = CATALOGO): Pack | null {
  if (cat.gratis.includes(funcion)) return null;
  return (
    PACKS_ORDER.find((p) => cat.packs[p].funciones.includes(funcion)) ?? null
  );
}

/**
 * Lo que se le dice al dueño sobre una función que no tiene.
 *
 * Nombra **una** vía, la más barata: el módulo suelto si existe, y si no el
 * pack. Enseñar las dos —«o el módulo, o el pack»— convierte el candado en un
 * párrafo; quien quiera comparar tiene la sección de planes al lado.
 */
export function textoBloqueo(funcion: Funcion, cat: Catalogo = CATALOGO): string {
  if (!esDisponible(funcion, cat)) return "Próximamente";
  const modulo = moduloDe(funcion, cat);
  if (modulo) return `Está en ${cat.modulos[modulo].nombre}`;
  const pack = packDe(funcion, cat);
  return pack ? `Entra con ${cat.packs[pack].nombre}` : "No disponible";
}

/**
 * El candado de una función para quien **ya tiene** sus funciones resueltas.
 *
 * `null` si la tiene —no hay nada que pintar—, y si no, el texto que dice con
 * qué se abre. Es el envoltorio de `textoBloqueo` para los componentes, que
 * reciben la lista de funciones del servidor y no un plan: con módulos sueltos
 * un negocio en Gratis puede tener funciones que ningún plan nombra, así que
 * preguntar por el nombre del plan dejaría candados falsos por todas partes.
 */
export function bloqueoDe(
  funciones: readonly Funcion[],
  funcion: Funcion,
  cat: Catalogo = CATALOGO,
): string | null {
  return funciones.includes(funcion) ? null : textoBloqueo(funcion, cat);
}

/* ── Límites ────────────────────────────────────────────────────────────────
   Constantes configurables y en un solo sitio. `null` = sin tope. Un `0` no es
   «sin tope»: es «no puedes», que es distinto y hay que poder distinguirlo.

   Ya no cuelgan del plan —de una escalera— sino de lo que el negocio tiene de
   verdad: cada tope dice qué función lo levanta. */

export type ClaveLimite =
  | "productos_max"
  | "fotos_productos_max"
  | "publicaciones_semana"
  | "flyers_mes"
  | "ofertas_vigentes_max";

/** El tope del catálogo, para el plan Gratis sin módulos. Antiabuso, no una
    frontera comercial: no se enseña como límite al dueño. */
const PRODUCTOS_GRATIS = 90;
const FOTOS_GRATIS = 10;

/** El tope de una clave. `null` = sin tope. */
export function limiteDe(
  funciones: ReadonlySet<Funcion>,
  clave: ClaveLimite,
  cat: Catalogo = CATALOGO,
): number | null {
  switch (clave) {
    case "productos_max":
      /* El tope del catálogo solo muerde en Gratis puro —sin ningún módulo ni
         pack—: en cuanto el negocio contrata algo, deja de aplicar. */
      return funciones.size > cat.gratis.length ? null : PRODUCTOS_GRATIS;
    case "fotos_productos_max":
      return funciones.has("fotos_ilimitadas") ? null : FOTOS_GRATIS;
    case "publicaciones_semana":
      /* Tres las trae Facebook ×3 —y con él Publicidad Max y Pro—; una, el
         módulo suelto. Y las dos funciones vienen juntas, así que se pregunta
         por la de tres primero. */
      if (funciones.has("publicaciones_fb_3")) return 3;
      return funciones.has("publicaciones_fb") ? 1 : 0;
    case "flyers_mes":
      return funciones.has("flyers") ? 10 : 0;
    case "ofertas_vigentes_max":
      return funciones.has("ofertas_flash") ? 3 : 0;
  }
}

/* ── La suscripción ───────────────────────────────────────────────────────── */

/** Cuántos días dura la prueba de Pro que recibe un negocio nuevo. */
export const TRIAL_DIAS = 30;

export function trialHastaDesde(ahora: Date): Date {
  return new Date(ahora.getTime() + TRIAL_DIAS * 86_400_000);
}

/** Un módulo suelto contratado, con su propia vigencia. */
export interface ModuloContratado {
  clave: ClaveModulo;
  desde: Date;
  /** `null` = sin vencimiento (se renueva solo hasta que se cancele). */
  hasta: Date | null;
}

/**
 * Lo que hace falta para resolver los permisos. Es la fila de `suscripciones`.
 *
 * `plan` es el **pack** contratado, no lo que manda: con prueba viva manda la
 * prueba, y con el pack vencido manda gratis. `modulos` son los sueltos, y cada
 * uno trae su propia fecha, así que un módulo puede seguir vivo aunque el pack
 * haya vencido.
 */
export interface Suscripcion {
  plan: Plan;
  estado: "activa" | "cancelada";
  trialHasta: Date | null;
  venceEn: Date | null;
  modulos: readonly ModuloContratado[];
}

/**
 * El pack que manda de verdad, sin contar módulos sueltos ni prueba.
 *
 * Tres reglas, en este orden:
 *
 * 1. Sin fila = gratis. Es el caso de las fichas que creó administración antes
 *    de que esto existiera, y el defecto tiene que ser el seguro.
 * 2. Cancelada = gratis, aunque queden días de trial o de mes pagado. Cancelar
 *    tiene que cortar en el acto; si no, no sirve para nada.
 * 3. Pack vencido = gratis. `vence_en` nulo significa «sin vencimiento».
 */
export function packEfectivo(
  suscripcion: Suscripcion | null,
  ahora: Date = new Date(),
  cat: Catalogo = CATALOGO,
): Plan {
  if (!suscripcion) return "gratis";
  if (suscripcion.estado === "cancelada") return "gratis";
  if (suscripcion.plan === "gratis") return "gratis";
  /* Una clave que ya no está en el catálogo —una fila con «basico» de antes de
     los packs, si la migración no ha corrido— cae a gratis en vez de reventar
     al pedir `cat.packs[plan]`. El defecto seguro, como el de la ficha sin fila. */
  if (!(suscripcion.plan in cat.packs)) return "gratis";
  if (suscripcion.venceEn && suscripcion.venceEn.getTime() <= ahora.getTime()) {
    return "gratis";
  }
  return suscripcion.plan;
}

/**
 * El plan que manda. Es el pack efectivo, salvo durante la prueba: **prueba
 * viva = Pro**, sea cual sea el pack contratado. Sirve para nombrar el plan en
 * la interfaz; para decidir permisos está `funcionesDe`, que además mira los
 * módulos sueltos.
 */
export function planEfectivo(
  suscripcion: Suscripcion | null,
  ahora: Date = new Date(),
  cat: Catalogo = CATALOGO,
): Plan {
  if (enTrial(suscripcion, ahora)) return "pro";
  return packEfectivo(suscripcion, ahora, cat);
}

/** Si ahora mismo está dentro de la prueba de Pro. Sirve para explicarlo. */
export function enTrial(
  suscripcion: Suscripcion | null,
  ahora: Date = new Date(),
): boolean {
  return Boolean(
    suscripcion &&
      suscripcion.estado === "activa" &&
      suscripcion.trialHasta &&
      suscripcion.trialHasta.getTime() > ahora.getTime(),
  );
}

/** Si un módulo suelto sigue vigente. */
function moduloVigente(m: ModuloContratado, ahora: Date): boolean {
  return !m.hasta || m.hasta.getTime() > ahora.getTime();
}

/**
 * La fila de `suscripciones` —o de `place_overrides`— convertida en lo que
 * espera `funcionesDe`.
 *
 * Las fechas de los módulos llegan del `jsonb` como cadenas ISO, no como
 * `Date`; aquí se normalizan una sola vez, para los dos sitios que leen una
 * fila: el catálogo (`queries.ts`) y el servidor de permisos.
 *
 * Y se descartan las claves **que ya no existen en el catálogo**: si un módulo
 * se retira, las filas que lo contrataron se quedan con su clave en el `jsonb`
 * y `MODULOS[clave]` sería `undefined`. Descartarlas aquí es lo que evita que
 * un negocio con un módulo viejo se caiga al leer sus permisos.
 */
export function aSuscripcion(
  row: {
    plan: Plan;
    estado: "activa" | "cancelada";
    trialHasta: Date | null;
    venceEn: Date | null;
    modulos: readonly { clave: string; desde: string; hasta: string | null }[];
  } | null,
): Suscripcion | null {
  if (!row) return null;
  const claves = new Set<string>(Object.keys(MODULOS));
  return {
    plan: row.plan,
    estado: row.estado,
    trialHasta: row.trialHasta,
    venceEn: row.venceEn,
    modulos: row.modulos
      .filter((m) => claves.has(m.clave))
      .map((m) => ({
        clave: m.clave as ClaveModulo,
        desde: new Date(m.desde),
        hasta: m.hasta ? new Date(m.hasta) : null,
      })),
  };
}

/**
 * **El resolutor.** Todas las funciones que el negocio tiene ahora mismo.
 *
 * Gratis siempre está. Encima: los módulos sueltos vigentes, las funciones del
 * pack efectivo, y —si hay prueba viva— el catálogo entero de Pro. Es la única
 * función que decide; `tiene` es un envoltorio de esta.
 */
export function funcionesDe(
  suscripcion: Suscripcion | null,
  ahora: Date = new Date(),
  cat: Catalogo = CATALOGO,
): Set<Funcion> {
  const set = new Set<Funcion>(cat.gratis);
  if (!suscripcion || suscripcion.estado === "cancelada") return set;

  /* La prueba vale Pro entero, con todo. */
  if (enTrial(suscripcion, ahora)) {
    for (const f of cat.packs.pro.funciones) set.add(f);
    return set;
  }

  const pack = packEfectivo(suscripcion, ahora, cat);
  if (pack !== "gratis") {
    for (const f of cat.packs[pack].funciones) set.add(f);
  }

  /* Los módulos sueltos se suman al pack: no se excluyen. */
  for (const m of suscripcion.modulos) {
    if (!moduloVigente(m, ahora)) continue;
    for (const f of cat.modulos[m.clave].funciones) set.add(f);
  }

  return set;
}

/** ¿Tiene esta función? Es el envoltorio de `funcionesDe` para una sola. */
export function tiene(
  suscripcion: Suscripcion | null,
  funcion: Funcion,
  ahora: Date = new Date(),
  cat: Catalogo = CATALOGO,
): boolean {
  return funcionesDe(suscripcion, ahora, cat).has(funcion);
}

/**
 * ¿Se pinta el sello de negocio verificado?
 *
 * Son **dos cosas a la vez**: que la administración haya verificado el negocio
 * —la columna `places.verificado`— y que sus funciones incluyan la del sello.
 * Se escriben juntas aquí y no repartidas porque las usan dos sitios que no se
 * hablan: el mapeo del catálogo y el negocio de prueba, que no pasa por él.
 */
export function muestraSelloVerificado(
  verificado: boolean,
  tieneVerificado: boolean,
): boolean {
  return verificado && tieneVerificado;
}

/**
 * El precio de cada plan, según el catálogo **de fábrica**.
 *
 * Es solo el de por defecto: para el precio vivo hay `usdDe(plan, cat)`. Existe
 * porque la prueba de `plans.test.ts` comprueba con él que los precios suben
 * con el plan, y esa comprobación es del catálogo que se escribe aquí.
 */
export const PRECIO_MENSUAL: Record<Plan, number> = {
  gratis: 0,
  esencial: PACKS.esencial.usd,
  publicidad_max: PACKS.publicidad_max.usd,
  pro: PACKS.pro.usd,
};

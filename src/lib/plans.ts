/**
 * Planes y permisos: la **única** fuente de verdad.
 *
 * Este archivo es puro a propósito —no importa la base de datos— porque lo leen
 * los dos lados: el servidor para decidir qué se permite, y el navegador para
 * pintar el candado sobre lo que no. Si el mapa viviera en dos sitios, el día
 * que uno cambie el otro seguiría enseñando una cerradura que ya no
 * corresponde, o —peor— dejaría de enseñarla sobre algo que sí está cerrado.
 *
 * La regla que gobierna todo esto: **un plan no borra datos**. Bajar de plan
 * solo deja de permitir y de enseñar; lo que el negocio ya escribió se queda
 * donde está y vuelve a aparecer si vuelve a subir.
 */

/** Los tres planes, de menor a mayor. El orden se usa para comparar. */
export const PLAN_ORDER = ["gratis", "basico", "pro"] as const;

export type Plan = (typeof PLAN_ORDER)[number];

/** Cómo se llama cada plan de cara al dueño. */
export const PLAN_LABEL: Record<Plan, string> = {
  gratis: "Gratis",
  basico: "Básico",
  pro: "Pro",
};

/* ── Las funciones de cada plan ──────────────────────────────────────────────
   Se escriben **una sola vez** y se acumulan: el plan dice explícitamente
   «todo lo del anterior y además», así que derivarlo impide que un plan de
   arriba se olvide de una función de abajo al añadir otra. */

/** Lo que ya tiene cualquiera que aparezca en La Verde. */
const GRATIS = [
  "pin",
  "perfil",
  "menu_qr",
  "busqueda_ia",
  "energia_respaldo",
  "stats_resumen",
] as const;

/** Lo que añade el plan Básico. */
const BASICO_EXTRA = [
  "menu_qr_sin_marca",
  "prioridad_ia",
  "hoy_hay",
  "whatsapp_pedido",
  "publicaciones_fb",
  "stats_basicas",
  "verificado",
] as const;

/** Lo que añade el plan Pro. */
const PRO_EXTRA = [
  "asistente_ia",
  "flyers",
  "reservas_whatsapp",
  "seguidores",
  "ofertas_flash",
  "ranking",
  "stats_completas",
] as const;

export const FEATURES_POR_PLAN = {
  gratis: GRATIS,
  basico: [...GRATIS, ...BASICO_EXTRA],
  pro: [...GRATIS, ...BASICO_EXTRA, ...PRO_EXTRA],
} as const;

/** Cualquier función del catálogo, sin importar en qué plan entre. */
export type Feature =
  (typeof FEATURES_POR_PLAN)[keyof typeof FEATURES_POR_PLAN][number];

/**
 * Qué es cada función, dicho para el dueño.
 *
 * Va aparte del mapa de permisos porque son dos cosas distintas —una decide y
 * la otra explica— y el `Record<Feature, string>` obliga a que no falte
 * ninguna: añadir una función sin texto no compila.
 */
export const FEATURE_TEXTO: Record<Feature, string> = {
  pin: "Tu pin en el mapa de La Verde",
  perfil: "Ficha completa: fotos, horario, menú y pagos",
  menu_qr: "Carta con enlace propio y QR para imprimir",
  busqueda_ia: "Te encuentran buscando con sus propias palabras",
  energia_respaldo: "Señal de energía de respaldo en tu ficha",
  stats_resumen: "Resumen de visitas del mes",
  menu_qr_sin_marca: "Tu carta, sin la marca de La Verde",
  prioridad_ia: "Prioridad cuando la IA recomienda",
  hoy_hay: "«Hoy hay»: publica lo que tienes del día",
  whatsapp_pedido: "Pedidos por WhatsApp desde tu ficha",
  publicaciones_fb: "Publicaciones automáticas en Facebook",
  stats_basicas: "Estadísticas de visitas y llamadas",
  verificado: "Sello de negocio verificado",
  asistente_ia: "Asistente de IA para escribir y responder",
  flyers: "Flyers listos para imprimir",
  reservas_whatsapp: "Reservas por WhatsApp",
  seguidores: "Seguidores de tu negocio y avisos",
  ofertas_flash: "Ofertas flash con cuenta atrás",
  ranking: "Posición destacada en el ranking",
  stats_completas: "Estadísticas completas y comparativas",
};

/** En qué plan entra una función. Es lo que escribe el candado. */
export function planDeFeature(feature: Feature): Plan {
  for (const plan of PLAN_ORDER) {
    if ((FEATURES_POR_PLAN[plan] as readonly Feature[]).includes(feature)) {
      return plan;
    }
  }
  /* Inalcanzable: `Feature` sale del propio mapa, así que toda función está en
     algún plan. El `pro` es solo para que esto compile sin un `!`. */
  return "pro";
}

/** «Disponible en Básico» / «Disponible en Pro». `null` si ya lo tiene. */
export function textoBloqueo(feature: Feature, plan: Plan): string | null {
  const minimo = planDeFeature(feature);
  if (PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(minimo)) return null;
  return `Disponible en ${PLAN_LABEL[minimo]}`;
}

/* ── Límites ────────────────────────────────────────────────────────────────
   Constantes configurables y en un solo sitio. `null` = sin tope. Un `0` no es
   «sin tope»: es «no puedes», que es distinto y hay que poder distinguirlo. */

export const LIMITES = {
  /** Antiabuso, no una frontera comercial: no se enseña como límite al dueño. */
  productos_max: { gratis: 80, basico: null, pro: null },
  fotos_productos_max: { gratis: 10, basico: null, pro: null },
  publicaciones_semana: { gratis: 0, basico: 1, pro: 3 },
  flyers_mes: { gratis: 0, basico: 0, pro: 10 },
  ofertas_vigentes_max: { gratis: 0, basico: 0, pro: 3 },
} as const satisfies Record<string, Record<Plan, number | null>>;

export type ClaveLimite = keyof typeof LIMITES;

/** El tope de una clave para un plan. `null` = sin tope. */
export function limiteDe(plan: Plan, clave: ClaveLimite): number | null {
  return LIMITES[clave][plan];
}

/* ── Plan efectivo y prueba ────────────────────────────────────────────────── */

/** Cuántos días dura la prueba de Pro que recibe un negocio nuevo. */
export const TRIAL_DIAS = 30;

export function trialHastaDesde(ahora: Date): Date {
  return new Date(ahora.getTime() + TRIAL_DIAS * 86_400_000);
}

/** Lo que hace falta para resolver el plan. Es la fila de `suscripciones`. */
export interface Suscripcion {
  plan: Plan;
  estado: "activa" | "cancelada";
  trialHasta: Date | null;
  venceEn: Date | null;
}

/**
 * El plan que manda de verdad.
 *
 * Cuatro reglas, en este orden:
 *
 * 1. Sin fila = gratis. Es el caso de las fichas que creó administración antes
 *    de que esto existiera, y el defecto tiene que ser el seguro.
 * 2. Cancelada = gratis, aunque queden días de trial o de mes pagado. Cancelar
 *    tiene que cortar en el acto; si no, no sirve para nada.
 * 3. **Prueba viva = Pro**, sea cual sea el plan contratado. Un negocio nuevo
 *    entra con `plan: gratis` y `trial_hasta` a 30 días, y esos 30 días valen
 *    Pro entero.
 * 4. Plan de pago vencido = gratis. `vence_en` nulo significa «sin
 *    vencimiento»: el cobro aquí es manual y quien no tiene fecha es porque no
 *    la necesita.
 */
export function planEfectivo(
  suscripcion: Suscripcion | null,
  ahora: Date = new Date(),
): Plan {
  if (!suscripcion) return "gratis";
  if (suscripcion.estado === "cancelada") return "gratis";
  if (suscripcion.trialHasta && suscripcion.trialHasta.getTime() > ahora.getTime()) {
    return "pro";
  }
  if (suscripcion.plan === "gratis") return "gratis";
  if (suscripcion.venceEn && suscripcion.venceEn.getTime() <= ahora.getTime()) {
    return "gratis";
  }
  return suscripcion.plan;
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

/** ¿Esta función entra en este plan? Sin tocar la base. */
export function incluye(plan: Plan, feature: Feature): boolean {
  return (FEATURES_POR_PLAN[plan] as readonly Feature[]).includes(feature);
}

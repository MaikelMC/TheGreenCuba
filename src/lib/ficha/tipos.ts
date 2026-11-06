/**
 * El vocabulario de la ficha: tipo principal, módulos y los datos de forma que
 * el panel escribe y la ficha pinta.
 *
 * Módulo puro a propósito —lo leen el schema de la base, el servidor, el
 * navegador y las pruebas— y sin dependencias para que pueda importarse desde
 * cualquier capa sin arrastrar React ni Drizzle.
 *
 * **Tipo principal y módulos son cosas distintas.** El tipo es de qué va el
 * negocio y solo siembra valores por defecto; los módulos son los bloques que
 * la ficha enciende uno a uno. Así una cafetería con reparto (`local` +
 * `domicilio`) no necesita un tipo compuesto que no existe en la vida real.
 *
 * **Tipos y familias.** Hay 16 tipos específicos. Cada uno pertenece a una de
 * las 4 familias (`FamiliaNegocio`), que son los valores que gobiernan el
 * comportamiento heredado: vista del catálogo, módulos sugeridos, acciones por
 * defecto y atributos. Usa `familiaDe(tipo)` para obtener la familia.
 */

/* ── Familias (los 4 valores viejos, ahora como agrupación de comportamiento) */

export const FAMILIAS_NEGOCIO = [
  "comida_domicilio",
  "cafeteria_restaurante",
  "tienda_mipyme",
  "servicios",
] as const;

export type FamiliaNegocio = (typeof FAMILIAS_NEGOCIO)[number];

/* ── Los 15 tipos específicos más «otro» = 16 en total ────────────────────── */

export const TIPOS_NEGOCIO = [
  "mipyme",
  "cafeteria",
  "restaurante",
  "comida_domicilio",
  "dulceria",
  "bar",
  "belleza",
  "hospedaje",
  "servicio_tecnico",
  "taller",
  "ropa",
  "ferreteria",
  "clases",
  "transporte",
  "eventos",
  "otro",
] as const;

export type TipoNegocio = (typeof TIPOS_NEGOCIO)[number];

/** Mapeo de tipo a familia. Governa vista del catálogo, módulos y acciones. */
const FAMILIA_DE: Record<TipoNegocio, FamiliaNegocio> = {
  mipyme:           "tienda_mipyme",
  cafeteria:        "cafeteria_restaurante",
  restaurante:      "cafeteria_restaurante",
  comida_domicilio: "comida_domicilio",
  dulceria:         "comida_domicilio",
  bar:              "cafeteria_restaurante",
  belleza:          "servicios",
  hospedaje:        "servicios",
  servicio_tecnico: "servicios",
  taller:           "servicios",
  ropa:             "tienda_mipyme",
  ferreteria:       "tienda_mipyme",
  clases:           "servicios",
  transporte:       "servicios",
  eventos:          "servicios",
  otro:             "servicios",
};

export function familiaDe(tipo: TipoNegocio): FamiliaNegocio {
  return FAMILIA_DE[tipo];
}

/** Nombre completo del tipo, para el panel y la administración. */
export const TIPO_NEGOCIO_LABEL: Record<TipoNegocio, string> = {
  mipyme:           "Mipyme de alimentos y productos varios",
  cafeteria:        "Cafetería",
  restaurante:      "Restaurante o paladar",
  comida_domicilio: "Comida a domicilio",
  dulceria:         "Dulcería, panadería o repostería",
  bar:              "Bar o club",
  belleza:          "Barbería, peluquería o salón de belleza",
  hospedaje:        "Renta de habitaciones u hostal",
  servicio_tecnico: "Servicios técnicos",
  taller:           "Taller mecánico o ponchera",
  ropa:             "Tienda de ropa, calzado o accesorios",
  ferreteria:       "Ferretería o materiales",
  clases:           "Gimnasio, academia o clases",
  transporte:       "Transporte, mensajería o taxis",
  eventos:          "Fotografía, eventos y decoración",
  otro:             "Otro negocio o servicio",
};

/** Nombre corto para las celdas de la cuadrícula de elección de tipo. */
export const TIPO_NEGOCIO_CORTO: Record<TipoNegocio, string> = {
  mipyme:           "Mipyme",
  cafeteria:        "Cafetería",
  restaurante:      "Restaurante",
  comida_domicilio: "Comida a domicilio",
  dulceria:         "Dulcería",
  bar:              "Bar o club",
  belleza:          "Barbería o salón",
  hospedaje:        "Hostal",
  servicio_tecnico: "Servicios técnicos",
  taller:           "Taller",
  ropa:             "Tienda de ropa",
  ferreteria:       "Ferretería",
  clases:           "Clases o gimnasio",
  transporte:       "Transporte",
  eventos:          "Fotografía o eventos",
  otro:             "Otro",
};

/** Nombre del icono de Lucide para cada tipo. */
export const TIPO_NEGOCIO_ICONO: Record<TipoNegocio, string> = {
  mipyme:           "Store",
  cafeteria:        "Coffee",
  restaurante:      "UtensilsCrossed",
  comida_domicilio: "Bike",
  dulceria:         "CakeSlice",
  bar:              "Wine",
  belleza:          "Scissors",
  hospedaje:        "BedDouble",
  servicio_tecnico: "Wrench",
  taller:           "Car",
  ropa:             "Shirt",
  ferreteria:       "Hammer",
  clases:           "Dumbbell",
  transporte:       "Truck",
  eventos:          "Camera",
  otro:             "Briefcase",
};

/** Valida en la frontera lo que llega por HTTP. */
export function esTipoNegocio(value: unknown): value is TipoNegocio {
  return (
    typeof value === "string" &&
    (TIPOS_NEGOCIO as readonly string[]).includes(value)
  );
}

/** Los bloques que puede encender una ficha. */
export const MODULOS_FICHA = ["domicilio", "local", "tienda", "servicios"] as const;

export type ModuloFicha = (typeof MODULOS_FICHA)[number];

export const MODULO_FICHA_LABEL: Record<ModuloFicha, string> = {
  domicilio: "Pedidos a domicilio",
  local: "En el local",
  tienda: "Tienda",
  servicios: "Servicios",
};

export function esModuloFicha(value: unknown): value is ModuloFicha {
  return (
    typeof value === "string" &&
    (MODULOS_FICHA as readonly string[]).includes(value)
  );
}

/** Quita repetidos y claves desconocidas, conservando el orden elegido. */
export function normalizarModulos(value: unknown): ModuloFicha[] {
  if (!Array.isArray(value)) return [];
  const vistos = new Set<ModuloFicha>();
  for (const item of value) {
    if (esModuloFicha(item)) vistos.add(item);
  }
  return [...vistos];
}

/** Encuadre de la portada: qué parte de la foto se ve al recortarla. */
export const PORTADA_ENCUADRES = ["centro", "arriba", "abajo"] as const;
export type PortadaEncuadre = (typeof PORTADA_ENCUADRES)[number];

export function esPortadaEncuadre(value: unknown): value is PortadaEncuadre {
  return (
    typeof value === "string" &&
    (PORTADA_ENCUADRES as readonly string[]).includes(value)
  );
}

/** `object-position` de CSS para el encuadre elegido. */
export function posicionPortada(encuadre: PortadaEncuadre | null | undefined): string {
  if (encuadre === "arriba") return "center top";
  if (encuadre === "abajo") return "center bottom";
  return "center center";
}

/**
 * Cuánto detalle enseña la tienda de sus existencias.
 *
 * `ninguna` no muestra nada; `disponible` solo disponible/agotado; `pocas`
 * añade «quedan pocas»; `exacta` usa el `stock` del producto.
 */
export const EXISTENCIAS_MODOS = ["ninguna", "disponible", "pocas", "exacta"] as const;
export type ExistenciasModo = (typeof EXISTENCIAS_MODOS)[number];

export function esExistenciasModo(value: unknown): value is ExistenciasModo {
  return (
    typeof value === "string" &&
    (EXISTENCIAS_MODOS as readonly string[]).includes(value)
  );
}

/** De dónde salió el catálogo. `erp` queda reservado para el sincronizador. */
export const CATALOGO_FUENTES = ["manual", "erp"] as const;
export type CatalogoFuente = (typeof CATALOGO_FUENTES)[number];

export function esCatalogoFuente(value: unknown): value is CatalogoFuente {
  return (
    typeof value === "string" &&
    (CATALOGO_FUENTES as readonly string[]).includes(value)
  );
}

/** Una categoría de la carta, con su orden de aparición. */
export interface MenuCategoria {
  nombre: string;
  orden: number;
}

/**
 * El «especial del día».
 *
 * `hasta` es una fecha `YYYY-MM-DD`: el día en que deja de valer. Se oculta
 * cuando ya pasó, sin cron ni borrado —la vigencia se decide al pintar—.
 */
export interface EspecialDelDia {
  titulo: string;
  descripcion?: string;
  /** Texto libre, como el precio de la carta: «12 USD», «Desde 5». */
  precio: string;
  moneda: string;
  hasta: string;
}

/** Cómo se compra en una tienda. */
export interface ComoComprar {
  recoger: boolean;
  apartar: boolean;
}

/** Cómo atiende un servicio. */
export interface ComoAtiende {
  conCita: boolean;
  sinCita: boolean;
  aDomicilio: boolean;
}

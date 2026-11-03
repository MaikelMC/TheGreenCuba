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
 */

/** Los cuatro tipos del alta. El orden es el del selector. */
export const TIPOS_NEGOCIO = [
  "comida_domicilio",
  "cafeteria_restaurante",
  "tienda_mipyme",
  "servicios",
] as const;

export type TipoNegocio = (typeof TIPOS_NEGOCIO)[number];

/** Cómo se llama el tipo en el panel. */
export const TIPO_NEGOCIO_LABEL: Record<TipoNegocio, string> = {
  comida_domicilio: "Comida a domicilio",
  cafeteria_restaurante: "Cafetería / restaurante",
  tienda_mipyme: "Tienda / mipyme",
  servicios: "Servicios",
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

/**
 * Módulos que el tipo sugiere al darse de alta.
 *
 * Es solo el punto de partida: el dueño puede encender cualquiera de los
 * cuatro, y apagar el recomendado. Ninguno de estos valores se escribe solo en
 * fichas existentes (ver el backfill del tipo).
 */
export const MODULOS_RECOMENDADOS_POR_TIPO: Record<TipoNegocio, readonly ModuloFicha[]> = {
  comida_domicilio: ["domicilio"],
  cafeteria_restaurante: ["local"],
  tienda_mipyme: ["tienda"],
  servicios: ["servicios"],
};

/** El título de la sección de catálogo cuando el dueño no escribe uno. */
export const TITULO_CATALOGO_POR_TIPO: Record<TipoNegocio, string> = {
  comida_domicilio: "Lo que ofrece",
  cafeteria_restaurante: "Menú",
  tienda_mipyme: "Productos",
  servicios: "Servicios y precios",
};

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

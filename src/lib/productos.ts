/**
 * Productos de la carta: las reglas puras que comparten el script de migración
 * y, desde la fase C, todas las vías de escritura.
 *
 * Sin base de datos y sin red a propósito: lo que decide aquí —qué precio es una
 * cifra, qué id hay que reasignar, a qué apunta una oferta— tiene que poder
 * probarse sin levantar nada, porque un fallo aquí no da error: deja un pedido
 * con un total mal calculado o una oferta apuntando a otro producto.
 */

import type { UserPlaceMenuItem } from "@/lib/places-store";

export type TipoPrecio = "fijo" | "desde" | "consultar";

/** La moneda que lleva pegada un precio («3 USD», «250cup»). `$` no está: en
    Cuba lo usan el dólar y el peso, así que no dice cuál. */
const MONEDA_EN_TEXTO: Record<string, string> = {
  usd: "USD",
  cup: "CUP",
  mlc: "MLC",
  eur: "EUR",
  "€": "EUR",
};

/**
 * El precio numérico de un texto libre, o `null` si no es una cifra sin dudas.
 *
 * Solo convierte lo inequívoco: «250», «3.50», «3,50», «3 USD» (si la moneda del
 * texto es la del producto). Todo lo demás queda en `null` y se sigue enseñando
 * el texto tal cual:
 *
 * - rangos («3–5», «100 a 400») y «Desde 8» → `desde`;
 * - sin ninguna cifra («A convenir») o vacío → `consultar`;
 * - «1.200» o «1,200»: puede ser mil doscientos o uno con dos → `null`;
 * - una moneda en el texto distinta de la del producto, o `$` → `null`.
 *
 * `tipoGuardado` manda sobre el tipo deducido: si el dueño ya dijo «desde», lo es
 * aunque el texto sea una cifra pelada.
 */
export function convertirPrecio(
  texto: string | null | undefined,
  moneda: string,
  tipoGuardado?: TipoPrecio | null,
): { precio: number | null; tipoPrecio: TipoPrecio } {
  const limpio = (texto ?? "").trim();
  const conTipo = (precio: number | null, deducido: TipoPrecio) => ({
    precio,
    tipoPrecio: tipoGuardado ?? deducido,
  });

  if (!/\d/.test(limpio)) return conTipo(null, "consultar");
  if (/^desde\b/i.test(limpio)) return conTipo(null, "desde");
  if (/\d\s*(?:-|–|—|\ba\b)\s*\d/i.test(limpio)) return conTipo(null, "desde");

  const match = /^(\d+(?:[.,]\d+)?)\s*([a-z]{3}|€|\$)?$/i.exec(limpio);
  if (!match) return conTipo(null, "fijo");

  const [, cifra = "", sufijo] = match;
  if (sufijo) {
    const codigo = MONEDA_EN_TEXTO[sufijo.toLowerCase()];
    if (!codigo || codigo !== moneda.toUpperCase()) return conTipo(null, "fijo");
  }

  /* Tres decimales tras el separador se leen igual como miles: ambiguo. */
  const decimales = /[.,](\d+)$/.exec(cifra)?.[1];
  if (decimales && decimales.length > 2) return conTipo(null, "fijo");

  const valor = Number(cifra.replace(",", "."));
  if (!Number.isFinite(valor) || valor < 0 || valor >= 1e10) {
    return conTipo(null, "fijo");
  }
  return conTipo(Math.round(valor * 100) / 100, "fijo");
}

/**
 * ¿Es un id que hay que reasignar? Los productos guardados antes de que
 * existiera el id no lo tienen, y los que pasaron por `conIds` tienen su
 * índice (`"0"`, `"1"`…): ninguno de los dos es estable ni único entre negocios.
 */
export function esIdPosicional(id: string | undefined | null): boolean {
  return !id || /^\d+$/.test(id.trim());
}

/** Una fila de `productos`, tal como la escribe el script. */
export interface FilaProducto {
  id: string;
  placeId: string;
  orden: number;
  categoria: string | null;
  nombre: string;
  descripcion: string;
  imagen: string | null;
  tag: string | null;
  precioTexto: string;
  /** `numeric` viaja como cadena con dos decimales. */
  precio: string | null;
  moneda: string;
  tipoPrecio: TipoPrecio;
  disponibilidad: "disponible" | "agotado";
  agotadoHasta: Date | null;
  oculto: boolean;
  destacado: boolean;
  stock: number | null;
  duracionMin: number | null;
  externalId: string | null;
  importacionId: string | null;
}

const vacioANull = (valor: string | null | undefined): string | null => {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
};

const enteroONull = (valor: unknown): number | null =>
  typeof valor === "number" && Number.isInteger(valor) && valor >= 0 ? valor : null;

/** Un producto del jsonb convertido en su fila. No pierde ningún campo. */
export function filaDeItem(
  item: UserPlaceMenuItem,
  placeId: string,
  orden: number,
  id: string,
): FilaProducto {
  const moneda = item.currency?.trim() || "MLC";
  const { precio, tipoPrecio } = convertirPrecio(item.price, moneda, item.tipoPrecio);
  return {
    id,
    placeId,
    orden,
    categoria: vacioANull(item.category),
    nombre: item.name ?? "",
    descripcion: item.description ?? "",
    imagen: vacioANull(item.image),
    tag: vacioANull(item.tag),
    precioTexto: item.price ?? "",
    precio: precio === null ? null : precio.toFixed(2),
    moneda,
    tipoPrecio,
    disponibilidad: item.disponibilidad === "agotado" ? "agotado" : "disponible",
    agotadoHasta:
      typeof item.agotadoHasta === "number" ? new Date(item.agotadoHasta) : null,
    oculto: item.oculto === true,
    destacado: item.destacado === true,
    stock: enteroONull(item.stock),
    duracionMin: enteroONull(item.duracionMin),
    externalId: vacioANull(item.externalId),
    importacionId: vacioANull(item.importacionId),
  };
}

export interface NegocioConMenu {
  id: string;
  name: string;
  menu: UserPlaceMenuItem[] | null;
}

/** Una fila de `ofertas` o `novedades` que apunta a un producto por id. */
export interface Referencia {
  id: string;
  negocioId: string;
  productoId: string | null;
}

export interface PlanNegocio {
  placeId: string;
  nombre: string;
  /** La carta con los ids nuevos puestos. Solo se escribe si `cambiaMenu`. */
  menu: UserPlaceMenuItem[];
  cambiaMenu: boolean;
  filas: FilaProducto[];
  reasignados: { antes: string; despues: string; nombre: string; motivo: "posicional" | "duplicado" }[];
}

export interface PlanMigracion {
  negocios: PlanNegocio[];
  remapeoOfertas: { id: string; de: string; a: string }[];
  remapeoNovedades: { id: string; de: string; a: string }[];
  sinPrecio: { placeId: string; negocio: string; id: string; nombre: string; texto: string; tipo: TipoPrecio }[];
  /** Ofertas que, ya remapeadas, no apuntan a ningún producto de su negocio. */
  ofertasHuerfanas: { id: string; negocioId: string; productoId: string }[];
}

/**
 * Qué hay que escribir para pasar `places.menu` a `productos`.
 *
 * Determinista dado `nuevoId`: el script lo llama con `generateId` y las pruebas
 * con un contador. La idempotencia no sale de aquí sino de escribir los ids
 * nuevos de vuelta en `places.menu`: en la segunda pasada ya no hay posicionales
 * y el plan solo produce el mismo upsert.
 *
 * Un id se reasigna si es posicional (ver `esIdPosicional`) o si ya lo usa otro
 * producto —en el mismo negocio o en otro—, porque en la tabla el id es la clave
 * primaria. Las referencias se remapean **dentro de su negocio**: la clave vieja
 * es la que veía el código actual, `item.id ?? String(índice)`.
 */
export function planMigracion(
  negocios: readonly NegocioConMenu[],
  ofertas: readonly Referencia[],
  novedades: readonly Referencia[],
  nuevoId: () => string,
  /** Ids que ya usa en la tabla algún producto de **otro** negocio. Hace falta
      al sincronizar un solo negocio: sin ellos, un id repetido en otro negocio
      no se vería y el upsert chocaría con su fila. */
  idsAjenos: ReadonlySet<string> = new Set(),
): PlanMigracion {
  const usados = new Set<string>(idsAjenos);
  const plan: PlanMigracion = {
    negocios: [],
    remapeoOfertas: [],
    remapeoNovedades: [],
    sinPrecio: [],
    ofertasHuerfanas: [],
  };

  /* Por negocio: clave vieja → id nuevo, y el conjunto de ids finales. */
  const mapas = new Map<string, Map<string, string>>();
  const idsFinales = new Map<string, Set<string>>();

  for (const negocio of negocios) {
    const menu = Array.isArray(negocio.menu) ? negocio.menu : [];
    const mapa = new Map<string, string>();
    const finales = new Set<string>();
    const reasignados: PlanNegocio["reasignados"] = [];
    const menuNuevo: UserPlaceMenuItem[] = [];
    const filas: FilaProducto[] = [];

    menu.forEach((item, indice) => {
      const viejo = item.id?.trim() || String(indice);
      let id = item.id?.trim() ?? "";
      let motivo: "posicional" | "duplicado" | null = null;
      if (esIdPosicional(id)) motivo = "posicional";
      else if (usados.has(id)) motivo = "duplicado";

      if (motivo) {
        do id = nuevoId();
        while (usados.has(id));
        reasignados.push({ antes: viejo, despues: id, nombre: item.name, motivo });
        /* Las referencias heredan la primera aparición de la clave **en este
           negocio**: si el id duplicado ya lo conserva otro producto de aquí,
           las ofertas siguen apuntando a ese. */
        if (!mapa.has(viejo) && !finales.has(viejo)) mapa.set(viejo, id);
      }
      usados.add(id);
      finales.add(id);

      menuNuevo.push(item.id === id ? item : { ...item, id });
      const fila = filaDeItem(item, negocio.id, indice, id);
      filas.push(fila);
      if (fila.precio === null) {
        plan.sinPrecio.push({
          placeId: negocio.id,
          negocio: negocio.name,
          id,
          nombre: fila.nombre,
          texto: fila.precioTexto,
          tipo: fila.tipoPrecio,
        });
      }
    });

    mapas.set(negocio.id, mapa);
    idsFinales.set(negocio.id, finales);
    plan.negocios.push({
      placeId: negocio.id,
      nombre: negocio.name,
      menu: menuNuevo,
      cambiaMenu: reasignados.length > 0,
      filas,
      reasignados,
    });
  }

  const remapear = (refs: readonly Referencia[], destino: PlanMigracion["remapeoOfertas"]) => {
    for (const ref of refs) {
      if (!ref.productoId) continue;
      const nuevo = mapas.get(ref.negocioId)?.get(ref.productoId);
      if (nuevo && nuevo !== ref.productoId) {
        destino.push({ id: ref.id, de: ref.productoId, a: nuevo });
      }
    }
  };
  remapear(ofertas, plan.remapeoOfertas);
  remapear(novedades, plan.remapeoNovedades);

  const remapeadas = new Map(plan.remapeoOfertas.map((r) => [r.id, r.a]));
  for (const oferta of ofertas) {
    const productoId = remapeadas.get(oferta.id) ?? oferta.productoId ?? "";
    if (!idsFinales.get(oferta.negocioId)?.has(productoId)) {
      plan.ofertasHuerfanas.push({ id: oferta.id, negocioId: oferta.negocioId, productoId });
    }
  }

  return plan;
}

/* ── Lectura: de la tabla a lo que ya consumen los componentes ────────── */

/** Lo que hace falta de una fila de `productos` para volver a ser un ítem. */
export interface FilaLeida {
  id: string;
  categoria: string | null;
  nombre: string;
  descripcion: string;
  imagen: string | null;
  tag: string | null;
  precioTexto: string;
  precio: string | number | null;
  moneda: string;
  tipoPrecio: TipoPrecio;
  disponibilidad: "disponible" | "agotado";
  agotadoHasta: Date | string | null;
  oculto: boolean;
  destacado: boolean;
  stock: number | null;
  duracionMin: number | null;
  externalId: string | null;
  importacionId: string | null;
}

/**
 * Una fila convertida en el `UserPlaceMenuItem` de siempre.
 *
 * Es lo que hace que la fase B no cambie nada a la vista: la ficha, la carta y
 * el panel siguen recibiendo el mismo tipo, solo que leído de la tabla.
 *
 * `tipoPrecio` solo viaja cuando dice algo que el texto no dice: con precio
 * numérico y tipo «desde» o «consultar». Un precio sin número se enseña con su
 * texto tal cual (decisión D4): si el script dedujo «desde» de «100-400»,
 * anteponer «Desde» cambiaría lo que ve el cliente.
 */
export function itemDeFila(fila: FilaLeida): UserPlaceMenuItem {
  const item: UserPlaceMenuItem = {
    id: fila.id,
    name: fila.nombre,
    description: fila.descripcion,
    price: fila.precioTexto,
    currency: fila.moneda,
  };
  if (fila.categoria) item.category = fila.categoria;
  if (fila.imagen) item.image = fila.imagen;
  if (fila.tag) item.tag = fila.tag;
  if (fila.disponibilidad === "agotado") item.disponibilidad = "agotado";
  if (fila.agotadoHasta) item.agotadoHasta = new Date(fila.agotadoHasta).getTime();
  if (fila.oculto) item.oculto = true;
  if (fila.destacado) item.destacado = true;
  if (fila.stock !== null) item.stock = fila.stock;
  if (fila.duracionMin !== null) item.duracionMin = fila.duracionMin;
  if (fila.externalId) item.externalId = fila.externalId;
  if (fila.importacionId) item.importacionId = fila.importacionId;
  if (fila.precio !== null && fila.tipoPrecio !== "fijo") item.tipoPrecio = fila.tipoPrecio;
  return item;
}

/** Sin acentos y en minúsculas: la misma forma que normaliza la búsqueda local. */
export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/* `TextEncoder` y no `Buffer`: este módulo también se importa en el navegador. */
const BYTES = new TextEncoder();

/** Tope del índice de un negocio, en bytes. */
export const TOPE_INDICE_BYTES = 1500;

/**
 * El índice ligero de la carta: los nombres normalizados de los productos
 * visibles, sin repetir, separados por `·`, hasta `TOPE_INDICE_BYTES`.
 *
 * Es lo que viaja en `/api/places` en lugar de la carta entera: la búsqueda sin
 * conexión necesita saber que «pizza» está en la carta de un negocio, no su
 * precio ni su foto. Se corta por producto entero, nunca a media palabra.
 */
export function indiceMenu(
  items: readonly UserPlaceMenuItem[],
  tope: number = TOPE_INDICE_BYTES,
): string {
  const vistos = new Set<string>();
  let indice = "";
  for (const item of items) {
    if (item.oculto) continue;
    const nombre = normalizarTexto(item.name ?? "");
    if (!nombre || vistos.has(nombre)) continue;
    const siguiente = indice ? `${indice} · ${nombre}` : nombre;
    if (BYTES.encode(siguiente).length > tope) break;
    vistos.add(nombre);
    indice = siguiente;
  }
  return indice;
}

/** Cuántos productos visibles tiene la carta. */
export function totalVisibles(items: readonly UserPlaceMenuItem[]): number {
  return items.filter((item) => !item.oculto && item.name?.trim()).length;
}

/** Cuántas entradas de la carta viajan al modelo por negocio. */
export const LINEAS_IA_POR_NEGOCIO = 12;

/**
 * La carta de un negocio como la lee el modelo de la búsqueda: una línea por
 * producto visible, «Nombre (chapita): precio moneda».
 *
 * Antes la armaba el navegador con lo que traía `/api/places`; ahora la arma el
 * servidor a partir de los ids, así que el cliente no puede colar texto en el
 * prompt y la portada no tiene que descargar las cartas. Mismo formato que
 * tenía `menuLines` en el home, para que el modelo no note el cambio.
 */
export function lineasMenuIA(
  items: readonly UserPlaceMenuItem[],
  max: number = LINEAS_IA_POR_NEGOCIO,
): string[] {
  const lineas: string[] = [];
  for (const item of items) {
    if (lineas.length >= max) break;
    if (item.oculto) continue;
    const nombre = item.name?.trim();
    if (!nombre) continue;
    const tag = item.tag?.trim();
    const precio = item.price?.trim();
    lineas.push(`${nombre}${tag ? ` (${tag})` : ""}${precio ? `: ${precio} ${item.currency}` : ""}`);
  }
  return lineas;
}

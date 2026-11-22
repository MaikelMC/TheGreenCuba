import { and, asc, eq, getTableColumns, inArray, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { db, lote, type Tx } from "@/lib/db";
import { novedades, ofertas, places, productos } from "@/lib/db/schema";
import { DEV_PLACE_ID, devPlace } from "@/lib/dev-place";
import { generateId } from "@/lib/utils";
import {
  CON_TILDE,
  itemDeFila,
  LINEAS_IA_POR_NEGOCIO,
  lineasMenuIA,
  planMigracion,
  puntosCoincidencia,
  SIN_TILDE,
  terminosDeBusqueda,
  type FilaProducto,
  type PlanNegocio,
} from "@/lib/productos";
import type { UserPlaceMenuItem } from "@/lib/places-store";

/**
 * La única puerta de lectura de la carta de un negocio, y —mientras dure la
 * fase B— el reflejo de `places.menu` en la tabla `productos`.
 *
 * **Lectura.** Todo lo que pinta una carta la pide aquí y recibe el
 * `UserPlaceMenuItem` de siempre, convertido desde la fila: la ficha, la carta
 * pública, el panel y la administración no cambian de tipo, solo de origen. El
 * negocio de prueba no tiene fila en `places` (ni puede tenerla en `productos`
 * por la clave foránea): para él se devuelve la carta del fixture, con el mismo
 * tipo, y ningún componente necesita un segundo camino (decisión D1).
 *
 * **Escritura.** Desde la fase C la fuente es la tabla y las escrituras viven
 * en `productos-escritura.ts`. Aquí queda `sincronizarNegocio`, que copia
 * `places.menu` a la tabla y solo usa `scripts/migrar-productos.ts`.
 *
 * Nada de aquí invalida la caché: el script corre fuera de Next, donde
 * `revalidateTag` no existe.
 */

/* ── Lectura ─────────────────────────────────────────────────────────── */

/** La carta de varios negocios, en su orden, también los ocultos. */
export async function cartasPorNegocio(
  placeIds: readonly string[],
): Promise<Map<string, UserPlaceMenuItem[]>> {
  const cartas = new Map<string, UserPlaceMenuItem[]>();
  const reales = placeIds.filter((id) => id !== DEV_PLACE_ID);
  if (placeIds.includes(DEV_PLACE_ID)) cartas.set(DEV_PLACE_ID, devPlace().menu);
  if (reales.length === 0) return cartas;

  const filas = await db
    .select()
    .from(productos)
    .where(inArray(productos.placeId, reales))
    .orderBy(asc(productos.placeId), asc(productos.orden));

  for (const id of reales) cartas.set(id, []);
  for (const fila of filas) cartas.get(fila.placeId)?.push(itemDeFila(fila));
  return cartas;
}

/** La carta de un negocio. Incluye los ocultos: filtra quien pinta. */
export async function productosDe(placeId: string): Promise<UserPlaceMenuItem[]> {
  return (await cartasPorNegocio([placeId])).get(placeId) ?? [];
}

/**
 * Los productos que coinciden con una consulta, por negocio, del más al menos
 * parecido.
 *
 * Busca **en la tabla**, no en el índice ligero: todos los productos visibles de
 * los negocios dados, comparando la consulta (sin tildes, sin palabras vacías y
 * en su raíz) con el nombre normalizado igual. El `translate()` usa la misma
 * tabla de letras que `sinTildes`, así que el filtro de la base y la puntuación
 * de aquí no discrepan.
 *
 * Con la carta de hoy (cientos de productos) un `LIKE` sobre la tabla es
 * instantáneo. Cuando pase de unas decenas de miles de filas convendrá un
 * índice trigram sobre la misma expresión (ver `productos.ts` en el esquema).
 */
export async function buscarProductos(
  consulta: string,
  placeIds: readonly string[],
): Promise<Map<string, UserPlaceMenuItem[]>> {
  const terminos = terminosDeBusqueda(consulta);
  const reales = placeIds.filter((id) => id !== DEV_PLACE_ID);
  const coincidencias = new Map<string, UserPlaceMenuItem[]>();
  if (terminos.length === 0 || reales.length === 0) return coincidencias;

  const normalizado = sql`translate(lower(${productos.nombre}), ${CON_TILDE}, ${SIN_TILDE})`;
  const filas = await db
    .select()
    .from(productos)
    .where(
      and(
        inArray(productos.placeId, reales),
        eq(productos.oculto, false),
        or(...terminos.map((termino) => sql`${normalizado} like ${`%${termino}%`}`)),
      ),
    )
    .limit(MAX_COINCIDENCIAS);

  const puntuadas = filas
    .map((fila) => ({ fila, puntos: puntosCoincidencia(fila.nombre, terminos) }))
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || a.fila.orden - b.fila.orden);
  for (const { fila } of puntuadas) {
    const lista = coincidencias.get(fila.placeId) ?? [];
    lista.push(itemDeFila(fila));
    coincidencias.set(fila.placeId, lista);
  }
  return coincidencias;
}

/** Tope de filas que devuelve una búsqueda de producto, para todos los negocios. */
const MAX_COINCIDENCIAS = 500;

/**
 * Las líneas de la carta que lee el modelo de la búsqueda, por negocio.
 *
 * No carga la carta entera: trae los `LINEAS_IA_POR_NEGOCIO` primeros productos
 * visibles de cada negocio (por `orden`) y les antepone los que coinciden con
 * la consulta, para que el producto buscado entre en las doce líneas aunque
 * esté al fondo de una carta de trescientos.
 */
export async function lineasIAPorNegocio(
  placeIds: readonly string[],
  coincidencias: ReadonlyMap<string, UserPlaceMenuItem[]> = new Map(),
): Promise<Map<string, string[]>> {
  const lineas = new Map<string, string[]>();
  const reales = placeIds.filter((id) => id !== DEV_PLACE_ID);
  if (placeIds.includes(DEV_PLACE_ID)) {
    const dev = lineasMenuIA(devPlace().menu);
    if (dev.length > 0) lineas.set(DEV_PLACE_ID, dev);
  }
  if (reales.length === 0) return lineas;

  const numerados = db
    .select({
      ...getTableColumns(productos),
      puesto: sql<number>`row_number() over (partition by ${productos.placeId} order by ${productos.orden})`.as("puesto"),
    })
    .from(productos)
    .where(and(inArray(productos.placeId, reales), eq(productos.oculto, false)))
    .as("numerados");
  const primeros = await db
    .select()
    .from(numerados)
    .where(lte(numerados.puesto, LINEAS_IA_POR_NEGOCIO))
    .orderBy(asc(numerados.placeId), asc(numerados.orden));

  const porNegocio = new Map<string, UserPlaceMenuItem[]>();
  for (const fila of primeros) {
    const lista = porNegocio.get(fila.placeId) ?? [];
    lista.push(itemDeFila(fila));
    porNegocio.set(fila.placeId, lista);
  }

  for (const id of reales) {
    const delante = coincidencias.get(id) ?? [];
    const carta = [...delante, ...(porNegocio.get(id) ?? [])];
    const negocio = lineasMenuIA(carta, LINEAS_IA_POR_NEGOCIO, delante.map((p) => p.id ?? ""));
    if (negocio.length > 0) lineas.set(id, negocio);
  }
  return lineas;
}

/* ── De `places.menu` a la tabla (solo `scripts/migrar-productos.ts`) ──
   Desde la fase C nadie escribe `places.menu` y esto ya no se llama desde la
   app: lo usa el script de migración, que tras la fase C exige `--forzar`. */

/** Las columnas de contenido: si alguna cambia, sube la versión. */
const CONTENIDO = [
  "orden",
  "categoria",
  "nombre",
  "descripcion",
  "imagen",
  "tag",
  "precio_texto",
  "precio",
  "moneda",
  "tipo_precio",
  "disponibilidad",
  "agotado_hasta",
  "oculto",
  "destacado",
  "stock",
  "duracion_min",
  "external_id",
  "importacion_id",
] as const;

const tupla = (prefijo: string) =>
  CONTENIDO.map((columna) => `${prefijo}."${columna}"`).join(", ");
const CAMBIO = sql.raw(`(${tupla('"productos"')}) is distinct from (${tupla("excluded")})`);
/** `excluded."columna"`: el valor que traía el insert que chocó. */
const ex = (columna: string) => sql.raw(`excluded."${columna}"`);

function upsert(q: Tx, filas: FilaProducto[]) {
  return q
    .insert(productos)
    .values(filas)
    .onConflictDoUpdate({
      target: productos.id,
      set: {
        orden: ex("orden"),
        categoria: ex("categoria"),
        nombre: ex("nombre"),
        descripcion: ex("descripcion"),
        imagen: ex("imagen"),
        tag: ex("tag"),
        precioTexto: ex("precio_texto"),
        precio: ex("precio"),
        moneda: ex("moneda"),
        tipoPrecio: ex("tipo_precio"),
        disponibilidad: ex("disponibilidad"),
        agotadoHasta: ex("agotado_hasta"),
        oculto: ex("oculto"),
        destacado: ex("destacado"),
        stock: ex("stock"),
        duracionMin: ex("duracion_min"),
        externalId: ex("external_id"),
        importacionId: ex("importacion_id"),
        /* Versión y fecha solo se mueven si el contenido cambió: sincronizar
           dos veces no debe parecer, en la fase C, un cambio ajeno. */
        version: sql`case when ${CAMBIO} then ${productos.version} + 1 else ${productos.version} end`,
        actualizadoEn: sql`case when ${CAMBIO} then now() else ${productos.actualizadoEn} end`,
      },
      /* Un id que ya es de otro negocio no se roba: el plan lo evita con
         `idsAjenos`, y esto es la red por si dos escrituras se cruzan. */
      setWhere: sql`${productos.placeId} = excluded."place_id"`,
    });
}

export type ResultadoSincronizacion =
  | { ok: true; plan: PlanNegocio; remapeoOfertas: number; remapeoNovedades: number }
  | { ok: false; motivo: "no_existe" | "carta_cambio" };

/**
 * Deja la tabla de un negocio exactamente como su `places.menu`.
 *
 * 1. Lee la carta (la fuente), sus ofertas y novedades, y los ids de la carta
 *    que ya usa otro negocio en la tabla.
 * 2. Si `menuEsperado` viene y la carta ya no es esa, no escribe nada: alguien
 *    guardó entre medias y otra pasada lo recogerá con la carta nueva. Es la
 *    guarda del script, para **todos** los negocios.
 * 3. Si hay ids posicionales o repetidos, escribe los nuevos en `places.menu`
 *    con una guarda de «la carta no cambió».
 * 4. En una transacción: remapea ofertas y novedades de este negocio, hace
 *    upsert de cada producto y borra de la tabla los que ya no están.
 */
export async function sincronizarNegocio(
  placeId: string,
  menuEsperado?: unknown,
): Promise<ResultadoSincronizacion> {
  const [lugar] = await db
    .select({ id: places.id, name: places.name, menu: places.menu })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);
  if (!lugar) return { ok: false, motivo: "no_existe" };

  const original = lugar.menu ?? null;
  if (menuEsperado !== undefined && JSON.stringify(original) !== JSON.stringify(menuEsperado)) {
    return { ok: false, motivo: "carta_cambio" };
  }

  const menu = (original ?? []) as UserPlaceMenuItem[];
  const idsCarta = menu.map((item) => item.id?.trim()).filter((id): id is string => Boolean(id));

  const [refsOfertas, refsNovedades, ajenos] = await Promise.all([
    db
      .select({ id: ofertas.id, negocioId: ofertas.negocioId, productoId: ofertas.productoId })
      .from(ofertas)
      .where(eq(ofertas.negocioId, placeId)),
    db
      .select({ id: novedades.id, negocioId: novedades.negocioId, productoId: novedades.productoId })
      .from(novedades)
      .where(eq(novedades.negocioId, placeId)),
    idsCarta.length > 0
      ? db
          .select({ id: productos.id })
          .from(productos)
          .where(and(inArray(productos.id, idsCarta), ne(productos.placeId, placeId)))
      : Promise.resolve([] as { id: string }[]),
  ]);

  const plan = planMigracion(
    [{ id: lugar.id, name: lugar.name, menu }],
    refsOfertas,
    refsNovedades,
    generateId,
    new Set(ajenos.map((fila) => fila.id)),
  );
  const negocio = plan.negocios[0]!;

  if (negocio.cambiaMenu) {
    const escrito = await db
      .update(places)
      .set({ menu: negocio.menu })
      .where(and(eq(places.id, placeId), sql`${places.menu} = ${JSON.stringify(original)}::jsonb`))
      .returning({ id: places.id });
    if (escrito.length === 0) return { ok: false, motivo: "carta_cambio" };
  }

  const ids = negocio.filas.map((fila) => fila.id);
  /* En una transacción: el remapeo, el volcado y la limpieza van juntos. */
  await lote((q) => [
    ...plan.remapeoOfertas.map((r) =>
      q
        .update(ofertas)
        .set({ productoId: r.a })
        .where(and(eq(ofertas.id, r.id), eq(ofertas.productoId, r.de))),
    ),
    ...plan.remapeoNovedades.map((r) =>
      q
        .update(novedades)
        .set({ productoId: r.a })
        .where(and(eq(novedades.id, r.id), eq(novedades.productoId, r.de))),
    ),
    ...(negocio.filas.length > 0 ? [upsert(q, negocio.filas)] : []),
    q
      .delete(productos)
      .where(
        ids.length > 0
          ? and(eq(productos.placeId, placeId), notInArray(productos.id, ids))
          : eq(productos.placeId, placeId),
      ),
  ]);

  return {
    ok: true,
    plan: negocio,
    remapeoOfertas: plan.remapeoOfertas.length,
    remapeoNovedades: plan.remapeoNovedades.length,
  };
}

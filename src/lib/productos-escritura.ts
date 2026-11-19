import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ofertas, places, productos } from "@/lib/db/schema";
import { invalidarCatalogo } from "@/lib/db/queries";
import { limite, puede } from "@/lib/plans-server";
import { generateId } from "@/lib/utils";
import { esIdPosicional, filaDeItem, itemDeFila } from "@/lib/productos";
import type {
  OperacionesCatalogo,
  ProductoAActualizar,
} from "@/lib/catalogo";
import type { UserPlaceMenuItem } from "@/lib/places-store";
import type { Disponibilidad } from "@/lib/disponibilidad";

/**
 * Escrituras de la carta, producto a producto (fase C).
 *
 * `places.menu` ya no se escribe: queda congelado como respaldo. Todas las vías
 * —el panel, la administración, Telegram, la importación— pasan por aquí, y
 * aquí se aplican las reglas que antes cada una aplicaba a su manera:
 *
 * - **Por producto.** Solo se tocan las filas que cambian; lo demás no se
 *   reescribe, así que el panel, Telegram y la importación no se pisan.
 * - **Versión.** Si la operación trae `version`, el `UPDATE` solo entra si la
 *   fila sigue en esa versión; si no, vuelve como conflicto con la fila actual.
 * - **Precio numérico.** Se recalcula con `convertirPrecio` (vía `filaDeItem`)
 *   en cada alta y en cada cambio de precio, moneda o tipo de precio.
 * - **Plan.** `productos_max` en cada alta; «Hoy hay» (`hoy_hay`) para tocar la
 *   disponibilidad: sin el plan esos campos se ignoran, no se rechaza todo.
 * - **Caché.** Toda escritura invalida la etiqueta del catálogo, que es la que
 *   sirven la lista, la ficha (`getPlaceById`) y la carta (`getPlaceBySlug`).
 */

export interface Conflicto {
  id: string;
  /** El producto como está ahora en la base, o `null` si ya no existe. */
  actual: UserPlaceMenuItem | null;
}

export type ResultadoCatalogo =
  | {
      ok: true;
      /** Id provisional → id definitivo de los productos creados. */
      creados: Record<string, string>;
      conflictos: Conflicto[];
      /** La carta entera tras guardar, con sus versiones. */
      productos: UserPlaceMenuItem[];
    }
  | { ok: false; error: string; status: number };

const CAMPOS_DISPONIBILIDAD = ["disponibilidad", "agotadoHasta"] as const;

function sinDisponibilidad<T extends Partial<UserPlaceMenuItem>>(item: T): T {
  const copia = { ...item };
  for (const campo of CAMPOS_DISPONIBILIDAD) delete copia[campo];
  return copia;
}

/** La carta de un negocio, leída de la tabla, en su orden. */
async function cartaActual(placeId: string) {
  return db
    .select()
    .from(productos)
    .where(eq(productos.placeId, placeId))
    .orderBy(productos.orden);
}

/** Las columnas de contenido de una fila, para un `UPDATE` o un `INSERT`. */
function columnas(item: UserPlaceMenuItem, placeId: string, orden: number, id: string) {
  const { id: _id, placeId: _place, orden: _orden, ...resto } = filaDeItem(
    item,
    placeId,
    orden,
    id,
  );
  return resto;
}

/** Aplica un cambio sobre el producto tal como está: lo que no viene, se queda. */
function fusionar(
  actual: UserPlaceMenuItem,
  cambios: Partial<UserPlaceMenuItem>,
): UserPlaceMenuItem {
  const fusionado: Record<string, unknown> = { ...actual };
  for (const [campo, valor] of Object.entries(cambios)) {
    if (campo === "id" || campo === "version") continue;
    if (valor === null || valor === undefined) delete fusionado[campo];
    else fusionado[campo] = valor;
  }
  return fusionado as unknown as UserPlaceMenuItem;
}

/**
 * Aplica unas operaciones sobre la carta de un negocio.
 *
 * Las comprobaciones —tope del plan, permiso de «Hoy hay»— van antes de
 * escribir nada. Después cada operación va por su cuenta: una que choca con la
 * versión vuelve como conflicto y las demás se guardan igual.
 */
export async function aplicarCatalogo(
  placeId: string,
  ops: OperacionesCatalogo,
): Promise<ResultadoCatalogo> {
  const [lugar] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);
  if (!lugar) return { ok: false, error: "Negocio no encontrado", status: 404 };

  const filas = await cartaActual(placeId);
  const porId = new Map(filas.map((fila) => [fila.id, fila]));
  const borrar = ops.borrar.filter((id) => porId.has(id));

  /* El tope, solo al crecer: un negocio que bajó de plan con más productos de
     los que permite puede seguir editando y borrando. */
  if (ops.crear.length > 0) {
    const tope = await limite(placeId, "productos_max");
    const total = filas.length - borrar.length + ops.crear.length;
    if (tope !== null && total > tope && total > filas.length) {
      return {
        ok: false,
        error: `Tu plan permite hasta ${tope} productos en la carta y tendrías ${total}. Quita alguno o mejora tu plan.`,
        status: 400,
      };
    }
  }

  const tocaDisponibilidad =
    ops.crear.some(({ item }) => item.disponibilidad === "agotado") ||
    ops.actualizar.some(({ cambios }) =>
      CAMPOS_DISPONIBILIDAD.some((campo) => campo in cambios),
    );
  const conHoyHay = tocaDisponibilidad ? await puede(placeId, "hoy_hay") : true;

  const conflictos: Conflicto[] = [];
  const creados: Record<string, string> = {};

  /* ── Actualizar ─────────────────────────────────────────────────────── */
  const actualizaciones = ops.actualizar.filter((op) => !borrar.includes(op.id));
  for (const op of actualizaciones) {
    const fila = porId.get(op.id);
    if (!fila) {
      conflictos.push({ id: op.id, actual: null });
      continue;
    }
    const resultado = await actualizarUno(placeId, fila, op, conHoyHay);
    if (!resultado) conflictos.push({ id: op.id, actual: await leerUno(placeId, op.id) });
  }

  /* ── Borrar ─────────────────────────────────────────────────────────── */
  if (borrar.length > 0) {
    /* Las ofertas del producto se van con él. Con la clave foránea de la fase
       C esto lo hace la base sola; se deja explícito para que no dependa de
       que la migración de la FK ya esté aplicada. */
    await db.batch([
      db.delete(ofertas).where(and(eq(ofertas.negocioId, placeId), inArray(ofertas.productoId, borrar))),
      db.delete(productos).where(and(eq(productos.placeId, placeId), inArray(productos.id, borrar))),
    ]);
  }

  /* ── Crear ──────────────────────────────────────────────────────────── */
  if (ops.crear.length > 0) {
    let siguiente = filas.reduce((max, fila) => Math.max(max, fila.orden), -1) + 1;
    const nuevas = ops.crear.map(({ idTemporal, item }) => {
      /* El id que trae se respeta si ya es definitivo —el asistente y la
         importación los generan así, y «Deshacer» de un borrado vuelve a
         crear el producto con el suyo—. Los provisionales del panel
         (`new-…`) y los posicionales reciben uno nuevo. */
      const id =
        idTemporal && !idTemporal.startsWith("new-") && !esIdPosicional(idTemporal) && !porId.has(idTemporal)
          ? idTemporal
          : generateId();
      if (idTemporal) creados[idTemporal] = id;
      const limpio = conHoyHay ? item : sinDisponibilidad(item);
      return { id, placeId, orden: siguiente++, ...columnas(limpio, placeId, 0, id) };
    });
    await db.insert(productos).values(nuevas);
  }

  /* ── Orden ──────────────────────────────────────────────────────────── */
  if (ops.orden) {
    const ids = ops.orden.map((id) => creados[id] ?? id);
    const consultas = ids.map((id, orden) =>
      db
        .update(productos)
        .set({ orden })
        .where(and(eq(productos.placeId, placeId), eq(productos.id, id))),
    );
    /* Reordenar no sube la versión: mover filas no choca con un agotado
       puesto por Telegram mientras el panel estaba abierto. */
    if (consultas.length > 0) {
      await db.batch(consultas as unknown as Parameters<typeof db.batch>[0]);
    }
  }

  await db
    .update(places)
    .set({ catalogoActualizadoEn: new Date() })
    .where(eq(places.id, placeId));
  invalidarCatalogo();

  const productosAhora = (await cartaActual(placeId)).map(itemDeFila);
  return { ok: true, creados, conflictos, productos: productosAhora };
}

async function leerUno(placeId: string, id: string): Promise<UserPlaceMenuItem | null> {
  const [fila] = await db
    .select()
    .from(productos)
    .where(and(eq(productos.placeId, placeId), eq(productos.id, id)))
    .limit(1);
  return fila ? itemDeFila(fila) : null;
}

/** Un `UPDATE` con la guarda de versión. Devuelve `false` si no entró. */
async function actualizarUno(
  placeId: string,
  fila: typeof productos.$inferSelect,
  op: ProductoAActualizar,
  conHoyHay: boolean,
): Promise<boolean> {
  const cambios = conHoyHay ? op.cambios : sinDisponibilidad(op.cambios);
  if (Object.keys(cambios).length === 0) return true;
  const fusionado = fusionar(itemDeFila(fila), cambios);

  const condiciones = [eq(productos.placeId, placeId), eq(productos.id, op.id)];
  if (op.version !== undefined) condiciones.push(eq(productos.version, op.version));

  const escritas = await db
    .update(productos)
    .set({
      ...columnas(fusionado, placeId, fila.orden, op.id),
      version: sql`${productos.version} + 1`,
      actualizadoEn: new Date(),
    })
    .where(and(...condiciones))
    .returning({ id: productos.id });
  return escritas.length > 0;
}

/**
 * «Hoy hay»: marca un producto como disponible o agotado, por id.
 *
 * Es el único camino de la disponibilidad —el panel, Telegram— y ya no tiene
 * respaldo por posición: desde la migración todos los productos tienen id.
 */
export async function setDisponibilidadProducto(
  placeId: string,
  productoId: string,
  estado: Disponibilidad,
  hasta: number | null,
): Promise<{ ok: true; version: number } | { ok: false }> {
  const agotadoHasta = estado === "agotado" && hasta != null ? new Date(hasta) : null;
  const [fila] = await db
    .update(productos)
    .set({
      disponibilidad: estado,
      agotadoHasta,
      version: sql`${productos.version} + 1`,
      actualizadoEn: new Date(),
    })
    .where(and(eq(productos.placeId, placeId), eq(productos.id, productoId)))
    .returning({ version: productos.version });
  if (!fila) return { ok: false };
  invalidarCatalogo();
  return { ok: true, version: fila.version };
}

/**
 * Borra los productos de una importación. Sus ofertas se van con ellos.
 * Devuelve cuántos productos se borraron.
 */
export async function deshacerImportacion(
  placeId: string,
  importacionId: string,
): Promise<number> {
  const ids = (
    await db
      .select({ id: productos.id })
      .from(productos)
      .where(and(eq(productos.placeId, placeId), eq(productos.importacionId, importacionId)))
  ).map((fila) => fila.id);
  if (ids.length === 0) return 0;
  const resultado = await aplicarCatalogo(placeId, { crear: [], actualizar: [], borrar: ids });
  return resultado.ok ? ids.length : 0;
}

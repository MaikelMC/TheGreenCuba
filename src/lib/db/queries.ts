import { and, asc, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { businessOwners, categories, placeImages, places, reviews, savedPlaces } from "@/lib/db/schema";
import { DEV_PLACE_ID, devPlace, devPlaceEnabled } from "@/lib/dev-place";
import type { UserPlacePhoto } from "@/lib/places-store";
import {
  toBusinessCategory,
  toUserPlace,
  type PlaceRow,
  type PlaceRowWithCategory,
} from "./mappers";

/**
 * Las consultas que comparten las rutas de API.
 *
 * Están juntas y no repartidas por cada `route.ts` porque las usan las tres
 * —listar, leer una, crear, editar— y la traducción de fila a tipo de cliente
 * tiene que ocurrir en un solo sitio. Las rutas se quedan con lo suyo: validar
 * la entrada y decidir el código de estado.
 */

/**
 * Etiqueta con la que se invalida el catálogo cacheado.
 *
 * **Todo el que escriba en `places`, `categories` o `place_images` tiene que
 * llamar a `revalidateTag(CATALOG_TAG, "max")` antes de responder.** Si se
 * olvida, el cambio no se ve hasta que caduque el TTL —cinco minutos— y el
 * síntoma es un panel que dice «guardado» y sigue enseñando lo viejo.
 *
 * El `"max"` es obligatorio desde Next 16 —la firma pide el perfil— y aquí no
 * cambia nada: el perfil se mira para decidir si además hay que regenerar las
 * rutas estáticas, nunca para buscar la etiqueta (ver
 * `incremental-cache/index.js`, donde la comparación es solo por `tag`). Está
 * puesto porque la alternativa, `updateTag`, revienta al llamarse desde un
 * `route.ts`: exige una Server Action y este proyecto no tiene ninguna.
 *
 * La etiqueta es una sola para las tres tablas y no una por tabla: el catálogo
 * se lee entero y se sirve entero, así que separarlas solo daría pie a
 * invalidar de menos.
 */
export const CATALOG_TAG = "catalog";

/** Cuánto aguanta una entrada sin que nadie la invalide. */
const CACHE_TTL_S = 300;

/**
 * Envuelve una lectura del catálogo para que no se repita contra Neon.
 *
 * El catálogo son 31 filas que cambian cuando un administrador entra al panel, y
 * se leen en **cada** carga de página: la lista del home, el mapa, cada ficha,
 * el panel y el `sitemap`. Sin esto, mil visitas son mil consultas para devolver
 * exactamente lo mismo. Con esto la base se toca una vez cada cinco minutos por
 * mucho tráfico que haya.
 *
 * **En desarrollo no se cachea**, a propósito. Aquí el catálogo se toca a mano
 * —`npm run db:seed`, un `UPDATE` desde el editor de Neon— y con la caché puesta
 * esos cambios tardarían hasta cinco minutos en verse, sin ningún síntoma que lo
 * explique: se busca el fallo en el `insert`, no en una caché que nadie
 * recuerda. La caché es para producción, que es donde está el tráfico.
 *
 * Las funciones pasan a ser `const` con función flecha porque `unstable_cache`
 * recibe la función como valor, no como declaración.
 */
function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  key: string,
): (...args: A) => Promise<R> {
  if (process.env.NODE_ENV !== "production") return fn;
  return unstable_cache(fn, [key], { tags: [CATALOG_TAG], revalidate: CACHE_TTL_S });
}

/**
 * Todas las columnas de `places` menos `embedding`.
 *
 * El vector son 1024 números por negocio y **no lo lee nadie de aquí**:
 * `toUserPlace` lo tiraba en cuanto llegaba. Traerlo costaba en torno a medio
 * mega por carga del catálogo —treinta negocios— viajando de Neon al servidor en
 * cada visita, y en esta red un cuerpo así se corta a mitad: es el `ECONNRESET`
 * que dejaba el mapa sin pines. La búsqueda por IA no pasa por aquí; consulta el
 * vector en su propia ruta.
 */
const { embedding: _embedding, ...PLACE_COLUMNS } = getTableColumns(places);

const SELECT_WITH_CATEGORY = { place: PLACE_COLUMNS, categoryName: categories.name };

function unwrap(row: { place: PlaceRow; categoryName: string | null }): PlaceRowWithCategory {
  return { ...row.place, categoryName: row.categoryName };
}

/**
 * Las fotos de varios negocios, agrupadas por negocio.
 *
 * Va en un segundo viaje y no en un JOIN con `place_images`. Uno a varios en un
 * `select` plano duplica la fila del negocio por cada foto que tenga, y luego
 * hay que desduplicar en JavaScript igualmente. Dos consultas se leen mejor, y
 * con `inArray` el catálogo entero sigue costando un solo viaje.
 *
 * El orden es el que quiere el carrusel: la portada primero. En Postgres, un
 * `ORDER BY` descendente sobre un booleano pone `true` delante de `false`, que
 * es justo lo que hace falta.
 */
async function photosByPlace(ids: string[]): Promise<Map<string, UserPlacePhoto[]>> {
  const grouped = new Map<string, UserPlacePhoto[]>();
  if (ids.length === 0) return grouped;

  const rows = await db
    .select()
    .from(placeImages)
    .where(inArray(placeImages.placeId, ids))
    .orderBy(desc(placeImages.isCover), asc(placeImages.sortOrder), asc(placeImages.createdAt));

  for (const row of rows) {
    const photo: UserPlacePhoto = {
      url: row.url,
      alt: row.alt,
      width: row.width,
      height: row.height,
      isCover: row.isCover,
    };
    const list = grouped.get(row.placeId);
    if (list) list.push(photo);
    else grouped.set(row.placeId, [photo]);
  }

  return grouped;
}

export interface ListPlacesOptions {
  city?: string | null;
  /** Slug de la categoría («restaurante»), no su etiqueta. */
  categorySlug?: string | null;
  /** Sin especificar devuelve todo, que es lo que necesita el panel de admin:
      un negocio cerrado tiene que seguir apareciendo para poder reabrirlo. */
  onlyActive?: boolean;
  limit?: number;
  /**
   * Cuela el negocio de prueba en la lista.
   *
   * Va de parámetro por lo mismo que en `getPlaceById`: esta función está
   * cacheada y la sesión —que es lo que decide— no se puede leer dentro de una
   * caché. Sin especificar manda `NODE_ENV`, así que en desarrollo entra solo y
   * en producción no entra para nadie.
   *
   * Aquí sí hace falta, a diferencia de la ficha: el mapa y el home se pintan
   * con esta lista, y sin esto el pin del negocio de prueba no habría forma de
   * verlo en producción.
   */
  includeDev?: boolean;
}

export const listPlaces = cached(async (options: ListPlacesOptions = {}) => {
  const filters = [];
  if (options.city) filters.push(eq(places.city, options.city));
  if (options.categorySlug) filters.push(eq(categories.slug, options.categorySlug));
  if (options.onlyActive) filters.push(eq(places.isActive, true));

  const limit = Math.min(options.limit ?? 200, 500);

  const rows = await db
    .select(SELECT_WITH_CATEGORY)
    .from(places)
    .leftJoin(categories, eq(categories.id, places.categoryId))
    /* Un solo `where` con `and(...)`. Antes se llamaba a `.where()` dos veces y
       en drizzle la segunda **sustituye** a la primera, así que filtrar por
       ciudad y categoría a la vez aplicaba solo la categoría y devolvía
       negocios de otra ciudad sin avisar. */
    .where(filters.length > 0 ? and(...filters) : undefined)
    /* Orden fijo, y no es cosmético: sin él Postgres devuelve las filas en el
       orden que le apetece —el del montón, que cambia al borrar y reinsertar— y
       con un `limit` por debajo del total eso significa que **qué negocios se
       caen de la lista es aleatorio**. La tira del landing pedía 8 de 10 activos
       y dejaba 2 fuera sin que nadie pudiera decir cuáles ni por qué.

       `nulls last` porque el rating es opcional: sin eso, un negocio sin
       valoraciones encabezaría la lista. Y `name` como desempate para que dos
       con la misma nota no bailen de sitio entre peticiones.

       El catálogo de la app no se apoya en este orden —reordena por distancia
       en el navegador—, así que aquí solo manda la presentación. */
    .orderBy(sql`${places.rating} desc nulls last`, asc(places.name))
    .limit(limit);

  const photos = await photosByPlace(rows.map((row) => row.place.id));

  const catalog = rows.map((row) =>
    toUserPlace({ ...unwrap(row), photos: photos.get(row.place.id) ?? [] }),
  );

  /* Solo en la lista **pública** —la que pide el catálogo con `onlyActive:
     true`—: el panel de administración pide todo lo que hay, y ahí un negocio
     que no existe en la base solo sirve para que editar su ficha falle con un
     404. Ver `src/lib/dev-place.ts`. */
  /* La guarda de producción vive aquí y no en `devPlace()`, que ya no la lleva:
     esa función solo construye los datos. Ver el porqué en `dev-place.ts`.

     `includeDev` lo pone quien sabe si hay sesión —la ruta de API—; sin él
     manda `NODE_ENV`. El `onlyActive` sigue siendo obligatorio: el panel de
     administración pide la lista entera y ahí un negocio que no está en la base
     solo serviría para que editarlo fallara con un 404. */
  const dev =
    options.onlyActive === true && (options.includeDev ?? devPlaceEnabled())
      ? devPlace()
      : null;
  if (!dev) return catalog;

  return [dev, ...catalog].slice(0, limit);
}, "places:list");

/**
 * Una ficha concreta. Se cachea por el mismo motivo que la lista —el `sitemap`
 * y las previsualizaciones la piden sin parar— y se invalida con la misma
 * etiqueta, que es por lo que no lleva una propia.
 */
export const getPlaceById = cached(
  async (id: string, options: { includeDev?: boolean } = {}) => {
  /* Antes de tocar la base: así la URL directa `/place/dev-cafe-la-ceiba`
     funciona igual que si la fila existiera, que es lo que hace falta para
     recargar la página sin volver al mapa. Aquí no lleva la guarda de
     `onlyActive` que sí tiene la lista: quien pide una ficha concreta ya sabe
     qué id quiere.

     `includeDev` es lo que la deja abierta **en producción** para las cuentas
     de `DEV_PLACE_VIEWERS`. Por defecto manda `NODE_ENV`, así que en desarrollo
     todo sigue igual sin que nadie pase nada. Va de parámetro y no se resuelve
     aquí dentro porque esta función está cacheada, y la sesión —que es lo que
     hace falta para decidir— no se puede leer dentro de una caché.

     El parámetro entra en la clave de la caché, así que la respuesta con el
     negocio de prueba y la respuesta sin él son dos entradas distintas y no se
     pisan. */
  if (id === DEV_PLACE_ID) {
    return (options.includeDev ?? devPlaceEnabled()) ? devPlace() : null;
  }

  const [row] = await db
    .select(SELECT_WITH_CATEGORY)
    .from(places)
    .leftJoin(categories, eq(categories.id, places.categoryId))
    .where(eq(places.id, id))
    .limit(1);

  if (!row) return null;

  const photos = await photosByPlace([row.place.id]);
  return toUserPlace({ ...unwrap(row), photos: photos.get(row.place.id) ?? [] });
  },
  "places:get",
);

/** Clave foránea a partir de la etiqueta («Restaurante»). `null` si no existe. */
export async function resolveCategoryId(label: string | null | undefined): Promise<string | null> {
  const name = label?.trim();
  if (!name) return null;
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, name))
    .limit(1);
  return row?.id ?? null;
}

/** Doce filas que cambian cuando un administrador toca el panel y se leen en
    todas partes: el desplegable del buscador, el mapa, los filtros, el home. */
export const listCategories = cached(async () => {
  const rows = await db.select().from(categories).orderBy(categories.sortOrder);
  return rows.map(toBusinessCategory);
}, "categories:list");

/** `true` si el slug ya lo usa otra categoría. El índice único lo rechazaría
    igual, pero un 409 con nombre es mejor que un error de Postgres. */
export async function categorySlugTaken(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return Boolean(row);
}

export async function findCategoryBySlug(slug: string) {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return row ?? null;
}

/**
 * El negocio que lleva esta persona, o `null`.
 *
 * Es el id y no la ficha entera a propósito: quien llama casi siempre quiere
 * después `getPlaceById`, que está cacheada, y duplicar aquí el `select` con
 * join dejaría dos formas de leer lo mismo que se separan en cuanto una cambie.
 */
export async function ownerPlaceId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ placeId: businessOwners.placeId })
    .from(businessOwners)
    .where(eq(businessOwners.userId, userId))
    .limit(1);
  return row?.placeId ?? null;
}

export interface PlaceStats {
  saved: number;
  reviews: number;
  photos: number;
}

/**
 * Los tres números que el panel puede contar de verdad.
 *
 * Antes aquí había «342 visitas esta semana», «87 clics en Cómo llegar» y «156
 * recomendaciones IA», todos inventados: no existe ninguna tabla que registre
 * visitas ni clics, así que no había forma de calcularlos. Estos tres sí salen
 * de la base, y enseñar tres cifras ciertas es mejor que seis falsas — una
 * métrica que no se puede comprobar no es una métrica.
 *
 * Los tres recuentos van en **una sola consulta** con subconsultas y no en tres
 * viajes: es un panel que se abre a menudo y cada ida y vuelta a Neon se paga.
 * El `::int` es necesario —`count(*)` devuelve `bigint`, que el driver entrega
 * como cadena— y sin él los números llegarían como `"7"` y el panel los pintaría
 * entre comillas.
 */
export async function placeStats(placeId: string): Promise<PlaceStats> {
  const [row] = await db
    .select({
      saved: sql<number>`(select count(*)::int from ${savedPlaces} where ${savedPlaces.placeId} = ${placeId})`,
      reviews: sql<number>`(select count(*)::int from ${reviews} where ${reviews.placeId} = ${placeId})`,
      photos: sql<number>`(select count(*)::int from ${placeImages} where ${placeImages.placeId} = ${placeId})`,
    })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);

  return row ?? { saved: 0, reviews: 0, photos: 0 };
}

/** Cuántos negocios cuelgan de una categoría. `places.category_id` es
    `onDelete: restrict`, así que borrarla con negocios dentro falla — mejor
    contarlos antes y decirlo con un número. */
export async function countPlacesInCategory(categoryId: string): Promise<number> {
  const rows = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.categoryId, categoryId));
  return rows.length;
}

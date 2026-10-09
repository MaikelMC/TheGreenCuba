import type { categories, places } from "@/lib/db/schema";
import type { BusinessCategory } from "@/lib/places";
import type {
  UserPlace,
  UserPlaceMenuItem,
  UserPlaceOferta,
  UserPlacePhoto,
} from "@/lib/places-store";
import { muestraSelloVerificado, planEfectivo, type Suscripcion } from "@/lib/plans";
import { slugify } from "@/lib/utils";

/**
 * Traducción entre las filas de Neon y los tipos que usa la app.
 *
 * Los dos vocabularios no coinciden y no deberían: la base guarda `category_id`
 * (una clave foránea) y el cliente maneja la etiqueta «Restaurante», la base
 * dice `neighborhood` y el cliente `barrio`, la base tiene un `timestamp` y el
 * cliente un número de milisegundos. Todo eso se resuelve aquí y solo aquí, para
 * que ni las rutas ni los componentes tengan que saberlo.
 *
 * El mapeo corre en el servidor: las rutas de API devuelven ya `UserPlace[]`,
 * así que las fechas se convierten a número antes de serializar y el cliente no
 * ve nunca un `Date` ni un `snake_case`.
 *
 * El `import type` de arriba se borra al compilar, así que este archivo se puede
 * importar desde un componente de cliente sin arrastrar drizzle al navegador.
 */

/**
 * La fila de `places`, con el vector como opcional.
 *
 * El `embedding` es opcional y no obligatorio porque las consultas del catálogo
 * ya no lo traen —`PLACE_COLUMNS` en `queries.ts`: son 1024 números por fila que
 * nadie lee y que hacían que el catálogo entero pesara medio mega—. Dejarlo
 * opcional permite que una fila completa siga encajando aquí, que es lo que
 * devuelve un `INSERT ... RETURNING` y lo que se le pasa a `toUserPlace`.
 */
export type PlaceRow = Omit<typeof places.$inferSelect, "embedding"> & {
  embedding?: typeof places.$inferSelect["embedding"];
};
type CategoryRow = typeof categories.$inferSelect;

/**
 * Fila de `places` más la etiqueta de su categoría, que viene de un JOIN.
 *
 * `photos` es opcional porque es de otra tabla: la traen las consultas del
 * catálogo, con un segundo viaje, y no la traen las rutas que responden con la
 * fila que acaban de escribir. Un alta nueva no tiene fotos todavía, así que
 * ausente y vacío significan lo mismo.
 */
export type PlaceRowWithCategory = PlaceRow & {
  categoryName: string | null;
  photos?: UserPlacePhoto[];
  /**
   * Las ofertas flash del negocio, **todas**, también las caducadas.
   *
   * Llegan de su propia tabla, en el segundo viaje del catálogo. La vigencia se
   * filtra al pintar y no aquí, por dos motivos: el panel necesita ver las
   * terminadas para poder reutilizarlas, y el catálogo cacheado sirve la misma
   * respuesta durante cinco minutos —filtrar en la consulta dejaría viva una
   * oferta que ya caducó—. Ver `src/lib/ofertas.ts`.
   */
  ofertas?: UserPlaceOferta[];
  /**
   * La fila de `suscripciones` del negocio, o `null`/ausente si nunca tuvo una.
   *
   * La traen las consultas del catálogo con un `leftJoin` y **no** las rutas que
   * responden con la fila que acaban de escribir: allí ausente y `null` dan lo
   * mismo, que es lo que significa «sin fila» —un plan gratis—. Decide si el
   * sello verificado se pinta, que es la única cosa de aquí abajo que depende
   * del plan.
   */
  suscripcion?: Suscripcion | null;
};

export function toUserPlace(row: PlaceRowWithCategory): UserPlace {
  return {
    id: row.id,
    /* El `slug` ya existe en `places` desde la primera siembra y hasta ahora no
       salía del servidor: sin esto la app no podía construir la URL corta del
       menú (`/m/{slug}`) ni el QR que la lleva. */
    slug: row.slug,
    name: row.name,
    category: row.categoryName ?? "Otro",
    icon: row.icon ?? undefined,
    logoUrl: row.logoUrl ?? undefined,
    lat: row.lat,
    lng: row.lng,
    address: row.address ?? "",
    /* El barrio cae a la ciudad cuando el negocio no tiene uno. Media siembra
       viene sin `neighborhood` —La Cabaña, entre otros—, y con el fallback
       anterior esos negocios acababan con la etiqueta «Cuba» en la ficha, que
       no es un barrio ni un dato: es un hueco disfrazado. `city` es `notNull`,
       así que nunca queda vacío. */
    barrio: row.neighborhood || row.city,
    /* La ciudad va aparte del barrio, y no es lo mismo: el barrio cae a la ciudad
       cuando falta, así que sin este campo el marcado estructurado de una ficha
       sin `neighborhood` habría puesto la ciudad como si fuera el barrio. */
    city: row.city,
    province: row.province,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    instagram: row.instagram ?? undefined,
    facebook: row.facebook ?? undefined,
    description: row.description ?? row.shortDescription ?? "",
    schedule: row.schedule ?? "",
    /* Sin respaldo y sin dato viajan igual —`null`/`undefined`— y la ficha los
       trata igual: no pinta nada. La distinción entre «no lo dijo» y «dijo que
       no» se pierde aquí a propósito, porque para pintar no cambia nada; quien
       la necesita —el filtro del buscador— pregunta por `tieneRespaldo`. */
    energiaRespaldo: row.energiaRespaldo ?? null,
    notaApagon: row.notaApagon ?? undefined,
    /* La base lo guarda desde la primera siembra; sin esto los filtros de
       «Tranquilo» y «Con música» del mapa no tenían nada que mirar. */
    vibe: row.vibe ?? [],
    payments: row.paymentMethods ?? [],
    menu: (row.menu ?? []) as UserPlaceMenuItem[],
    /* El cartel de texto que había aquí se sustituye por las ofertas flash. Las
       columnas `offer_text`/`offer_expiry` siguen en la tabla y siguen
       llegando, porque **los proyectos sí las usan** —ofrecen un paquete, no un
       plato—; lo que se retira es la «Oferta especial» del panel de negocio. */
    offer: row.offerText
      ? { text: row.offerText, expiry: row.offerExpiry ?? "" }
      : null,
    ofertas: row.ofertas ?? [],
    status: row.status,
    pedidosWhatsapp: row.pedidosWhatsapp,
    plan: row.plan,
    isActive: row.isActive,
    reviewStatus: row.reviewStatus,
    /* El sello son **dos cosas a la vez**: que la administración haya verificado
       el negocio —la columna cruda— y que su plan incluya la función. Se resuelve
       aquí, en el servidor, y no en los componentes: decidirlo en el navegador
       dejaría el sello puesto en un negocio que dejó de pagarlo, y el mapa de
       planes no viaja por ficha. El `verificado` crudo sale igual para que el
       panel de administración enseñe y edite la verdad. */
    verificado: row.verificado,
    selloVerificado: muestraSelloVerificado(
      row.verificado,
      planEfectivo(row.suscripcion ?? null),
    ),
    isBoosted: row.isBoosted,
    boostExpiresAt: row.boostExpiresAt ?? "",
    rating: row.rating ?? undefined,
    aiTags: row.aiTags ?? undefined,
    priceLabel: row.priceLabel ?? undefined,
    /* Las fotos viven en su propia tabla y llegan ya agrupadas por quien
       consulta. Si no vinieron —una ruta que responde con la fila recién
       escrita— la lista va vacía, que es lo que significa no tener fotos. */
    photos: row.photos ?? [],
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export function toBusinessCategory(row: CategoryRow): BusinessCategory {
  return {
    /* `slug` y no `id`: el cliente identifica las categorías por un valor
       legible («restaurante») que además es lo que guarda el formulario, y el
       `id` es un aleatorio que no significa nada fuera de la base. */
    value: row.slug,
    label: row.name,
    emoji: row.emoji ?? "📍",
    icon: row.icon ?? undefined,
  };
}

/**
 * Campos de escritura, a partir de lo que manda el cliente.
 *
 * Se construye solo con lo que viene en `patch`: en un PATCH parcial, escribir
 * `undefined` en una columna la dejaría a `null` y borraría datos que el
 * formulario ni siquiera tocó. Lo que no llega, no se escribe.
 *
 * `categoryId` va aparte porque resolver la etiqueta «Restaurante» a su clave
 * foránea es cosa de quien llama, que es quien tiene la tabla delante.
 */
export function toPlaceValues(
  patch: Partial<UserPlace>,
  categoryId: string | null,
): Partial<typeof places.$inferInsert> {
  const values: Partial<typeof places.$inferInsert> = {};

  if (patch.name !== undefined) values.name = patch.name;
  if (categoryId !== null) values.categoryId = categoryId;
  if (patch.icon !== undefined) values.icon = patch.icon || null;
  /* Vaciar el campo quita el logo —`|| null`—, que es lo que hace quien lo
     borra a propósito: sin esto no habría forma de volver a la portada. */
  if (patch.logoUrl !== undefined) values.logoUrl = patch.logoUrl || null;
  if (patch.lat !== undefined) values.lat = patch.lat;
  if (patch.lng !== undefined) values.lng = patch.lng;
  if (patch.address !== undefined) values.address = patch.address;
  if (patch.barrio !== undefined) values.neighborhood = patch.barrio;
  /* El teléfono faltaba aquí, y no es un detalle: el formulario de
     administración no lo pedía y esta lista lo habría tirado igualmente. Una
     cadena vacía lo borra —`|| null`—, que es lo que hace quien vacía el campo
     a propósito. */
  if (patch.phone !== undefined) values.phone = patch.phone || null;
  /* `website` no estaba en la lista y era el único de los cuatro que ya tenía
     columna: sin esto, lo que el formulario de contacto escribía se caía en
     silencio aquí, que es la lista blanca por la que pasan todos los `PATCH`. */
  if (patch.website !== undefined) values.website = patch.website || null;
  if (patch.whatsapp !== undefined) values.whatsapp = patch.whatsapp || null;
  if (patch.instagram !== undefined) values.instagram = patch.instagram || null;
  if (patch.facebook !== undefined) values.facebook = patch.facebook || null;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.schedule !== undefined) values.schedule = patch.schedule;
  /* `?? null` y no `|| null`: los cuatro valores son cadenas no vacías, así que
     el `||` daría lo mismo, pero aquí un `""` no es un valor válido y
     convertirlo en `null` sí es lo correcto —el formulario manda cadena vacía
     cuando no se elige—. Se pasa por `esEnergia` en la ruta, no aquí. */
  if (patch.energiaRespaldo !== undefined) {
    values.energiaRespaldo = patch.energiaRespaldo || null;
  }
  if (patch.notaApagon !== undefined) values.notaApagon = patch.notaApagon || null;
  if (patch.payments !== undefined) values.paymentMethods = patch.payments;
  if (patch.menu !== undefined) values.menu = patch.menu;
  if (patch.offer !== undefined) {
    values.offerText = patch.offer?.text ?? null;
    values.offerExpiry = patch.offer?.expiry ?? null;
  }
  if (patch.status !== undefined) values.status = patch.status;
  if (patch.pedidosWhatsapp !== undefined) {
    values.pedidosWhatsapp = patch.pedidosWhatsapp;
  }
  if (patch.plan !== undefined) values.plan = patch.plan ?? null;
  if (patch.isActive !== undefined) values.isActive = patch.isActive;
  if (patch.reviewStatus !== undefined) values.reviewStatus = patch.reviewStatus;
  /* El sello es cosa de administración —la ruta le tira el campo a todo el que
     no lo sea— y la fecha se sella sola: nadie la escribe a mano, y encender el
     sello dejando la fecha vieja —o apagarlo dejándola puesta— sería mentir. */
  if (patch.verificado !== undefined) {
    values.verificado = patch.verificado;
    values.verificadoEn = patch.verificado ? new Date() : null;
  }
  if (patch.isBoosted !== undefined) values.isBoosted = patch.isBoosted;
  if (patch.boostExpiresAt !== undefined) values.boostExpiresAt = patch.boostExpiresAt;
  if (patch.rating !== undefined) values.rating = patch.rating ?? null;
  if (patch.priceLabel !== undefined) values.priceLabel = patch.priceLabel;
  if (patch.aiTags !== undefined) values.aiTags = patch.aiTags;

  /* `photos` y `distanceLabel` no tienen columna: las fotos van a su propia
     tabla y la distancia la calcula el render, que es quien tiene la ubicación
     del usuario. Se quedan fuera del mapeo a propósito, no por olvido.

     `aiReasoning` estaba en esta lista y ya no existe: nadie lo escribía, nadie
     lo leía, y la ficha lo pintaba con un texto de relleno creyendo que venía
     de la base. */

  return values;
}

/** Fila nueva completa. El `slug` solo se calcula al crear. */
export function toNewPlaceValues(
  input: Partial<UserPlace>,
  categoryId: string | null,
  id: string,
): typeof places.$inferInsert {
  return {
    id,
    name: input.name ?? "",
    slug: slugify(input.name ?? id),
    description: input.description ?? null,
    categoryId,
    lat: input.lat ?? 0,
    lng: input.lng ?? 0,
    address: input.address ?? null,
    city: input.city ?? "",
    province: input.province ?? "",
    reviewStatus: "pending",
    neighborhood: input.barrio ?? null,
    ...toPlaceValues(input, categoryId),
  } as typeof places.$inferInsert;
}

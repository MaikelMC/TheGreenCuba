/**
 * Los tipos del catálogo tal como los usa la app.
 *
 * Aquí vivían además la lectura y la escritura en `localStorage`, con su
 * sembrado desde una lista del código. Se han ido con la migración a Neon: el
 * catálogo lo sirve `/api/places` y la base es la única fuente. Dejarlas habría
 * sido mantener dos verdades que se separan en cuanto una falla, sin forma de
 * saber cuál manda.
 *
 * Queda el vocabulario, que siguen usando el provider, las rutas de API y los
 * paneles. El nombre del archivo ya no describe lo que hay dentro —es
 * `places-store` y no guarda nada—, pero renombrarlo toca una treintena de
 * importaciones y el valor es cosmético.
 */

export type PlaceStatus = "active" | "closed" | "temporary_closed";

export interface UserPlaceMenuItem {
  name: string;
  description: string;
  /**
   * Texto libre, tal como lo escribe el dueño: `"1200"`, `"3–5 USD"`, `"Desde 8"`.
   * **No es un número.** El jsonb lo guarda como cadena a propósito y convertirlo
   * con `Number()` dejaba en cero todo lo que no fuera una cifra pelada.
   */
  price: string;
  currency: string;
  /** Chapita del producto («Popular», «Nuevo», «2x1»). Vacío = sin chapita. */
  tag?: string;
}

export interface UserPlaceOffer {
  text: string;
  expiry: string;
}

/**
 * Una foto subida del negocio.
 *
 * La `url` es la del bucket, entera. El cliente no sabe nada de R2: no ve la
 * clave del objeto ni el nombre del bucket, solo una dirección que puede pedir.
 * `isCover` llega ya ordenado desde la API —la portada primero—, porque es la
 * que se enseña en la ficha.
 */
export interface UserPlacePhoto {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  isCover: boolean;
}

export interface UserPlace {
  id: string;
  name: string;
  category: string;
  /**
   * Nombre del icono Lucide que el dueño eligió para su pin. Vacío o ausente
   * significa «el de mi categoría»; la regla vive en `placeIcon`
   * (`src/lib/places.ts`), no aquí.
   */
  icon?: string;
  lat: number;
  lng: number;
  address: string;
  barrio: string;
  description: string;
  schedule: string;
  /**
   * Ambiente del lugar («Tranquilo», «Musical», «Céntrico»). La base ya lo
   * guardaba desde la primera siembra y el mapeo no lo pasaba, así que los
   * filtros del mapa no tenían con qué filtrar.
   */
  vibe?: string[];
  payments: string[];
  menu: UserPlaceMenuItem[];
  offer: UserPlaceOffer | null;
  status: PlaceStatus;
  isBoosted: boolean;
  boostExpiresAt: string;
  rating?: number;
  /** Vacío o ausente = el negocio todavía no tiene fotos subidas. */
  photos?: UserPlacePhoto[];
  /* Hubo aquí un `aiReasoning` que no tenía columna detrás: `toUserPlace` nunca
     lo llenaba, así que llegaba siempre `undefined` y quien lo pintara creía
     estar enseñando un dato de la base. Se quitó en vez de dejar el hueco. */
  aiTags?: string[];
  distanceLabel?: string;
  priceLabel?: string;
  createdAt: number;
  updatedAt?: number;
}

export type NewUserPlace = Omit<
  UserPlace,
  "id" | "createdAt" | "updatedAt"
> &
  Partial<Pick<UserPlace, "status" | "isBoosted" | "boostExpiresAt">>;

export type UserPlacePatch = Partial<
  Omit<UserPlace, "id" | "createdAt" | "updatedAt">
>;

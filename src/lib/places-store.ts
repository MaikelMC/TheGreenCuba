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
  price: string;
  currency: string;
}

export interface UserPlaceOffer {
  text: string;
  expiry: string;
}

/** Sin columna en la base: el carrusel de la ficha se pinta con lo que haya. */
export interface UserPlaceSlide {
  gradient: string;
  label: string;
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
  slides?: UserPlaceSlide[];
  aiReasoning?: string;
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

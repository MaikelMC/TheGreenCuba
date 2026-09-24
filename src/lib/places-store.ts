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

/** Los dos planes del alta. `null` en `UserPlace.plan` = no eligió ninguno. */
export type PlacePlan = "trial" | "paid";

/**
 * Cómo se llama cada plan **fuera** del formulario de alta.
 *
 * Allí se venden con otros nombres —«Eres nuevo», «Plan de pago»— porque están
 * compitiendo entre sí; en el panel lo que hace falta es reconocer de un vistazo
 * qué eligió el dueño, y «Eres nuevo» no dice que sea el mes de prueba.
 */
export const PLAN_LABEL: Record<PlacePlan, string> = {
  trial: "Prueba gratis",
  paid: "Plan de pago",
};

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
  /**
   * Ciudad y provincia, tal como están en la base.
   *
   * Opcionales y no obligatorias a propósito: `NewUserPlace` se deriva de este
   * tipo, así que hacerlas obligatorias obligaría a rellenarlas en todos los
   * formularios que crean un negocio, que no las piden porque las pone el
   * servidor. Existen para el `PostalAddress` del marcado estructurado y para el
   * título de la ficha: sin localidad, un `LocalBusiness` no está atado a ningún
   * sitio.
   */
  city?: string;
  province?: string;
  /** Contacto del negocio cuando la base lo tiene. La ficha lo usa en el
      marcado estructurado; el panel todavía no lo edita. */
  phone?: string;
  website?: string;
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
  /**
   * El plan que eligió el dueño al dar de alta el negocio, y que se queda con
   * la ficha: es lo que el administrador ve en la solicitud antes de aprobarla.
   *
   * Opcional porque media tabla no pasó por ese formulario —la siembra, las
   * fichas que crea administración— y `null`/`undefined` significan lo mismo:
   * aquí nadie eligió plan.
   */
  plan?: PlacePlan | null;
  /**
   * Si la ficha está publicada. `false` = pendiente de que un administrador la
   * apruebe, que es como nacen los negocios dados de alta desde el perfil.
   *
   * Es distinto de `status`, y la diferencia importa: `status` es lo que dice
   * el dueño sobre si su negocio está abierto ahora mismo —y la ficha se enseña
   * igual, cerrada—, mientras que esto lo decide el sistema y significa que la
   * ficha todavía no existe para nadie de fuera.
   *
   * Lo escribe solo la administración: `toPlaceValues` no lo mapea, así que un
   * `PATCH` del dueño no puede publicarse a sí mismo.
   */
  isActive: boolean;
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

/* Los cuatro campos del final se **quitan** del `Omit` para volver a entrar por
   el `Partial`, y ese paso es necesario: una intersección no ablanda lo que ya
   es obligatorio en el tipo de la izquierda. Dejando `isActive` en el `Omit`,
   `Partial<Pick<...>>` no lo hace opcional y cada formulario que crea un
   negocio tendría que declarar si se publica, que es una decisión del servidor
   y no suya. */
export type NewUserPlace = Omit<
  UserPlace,
  "id" | "createdAt" | "updatedAt" | "status" | "isActive" | "isBoosted" | "boostExpiresAt"
> &
  Partial<Pick<UserPlace, "status" | "isActive" | "isBoosted" | "boostExpiresAt">>;

export type UserPlacePatch = Partial<
  Omit<UserPlace, "id" | "createdAt" | "updatedAt">
>;

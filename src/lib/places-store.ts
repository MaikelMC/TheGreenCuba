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

import type { ProjectOfferPackage } from "@/lib/db/schema/project_requests";
import type { Disponibilidad } from "@/lib/disponibilidad";
import type { EnergiaRespaldo } from "@/lib/energia";

export type PlaceStatus = "active" | "closed" | "temporary_closed";
export type PlaceReviewStatus = "pending" | "approved" | "rejected";

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
  /**
   * Identificador estable del producto dentro de la carta.
   *
   * Es lo que usa `setDisponibilidad(negocioId, productoId, …)` para señalar
   * **un** producto sin depender de su posición en el array —que cambia en
   * cuanto el dueño borra una entrada de en medio—. Se genera al guardar la
   * carta si la entrada no lo tiene, y no se recalcula después.
   */
  id?: string;
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
  /**
   * Familia del producto: «Entrantes», «Bebidas», «Servicios». Texto libre, no
   * una clave foránea — es lo que el dueño escribe en su panel para agrupar su
   * propia carta, y dos negocios no tienen por qué llamar igual a lo mismo.
   *
   * Vive aquí y no en la tabla `place_menu_items` porque `menu` es el jsonb que
   * la app lee de verdad: la tabla existe, guarda el precio como número y
   * pierde el texto libre («3–5 USD») que este campo acompaña.
   *
   * Opcional: media carta ya guardada no tiene categoría, y sin ninguna —o con
   * una sola— no hay navegación que ofrecer, así que la carta se lee igual.
   */
  category?: string;
  /**
   * «Hoy hay»: si el producto está disponible o agotado ahora.
   *
   * Ojo: es el valor **guardado**, no el efectivo. Un producto marcado como
   * `agotado` con `agotadoHasta` ya vencido se lee como disponible al pintar
   * —`estaAgotado` en `disponibilidad.ts` lo resuelve—, sin cron ni escritura.
   * Opcional: todo lo guardado antes de esta función no lo tiene y equivale a
   * `disponible`.
   */
  disponibilidad?: Disponibilidad;
  /** Cuándo vuelve solo a estar disponible, en epoch ms. `null` = sin fecha. */
  agotadoHasta?: number | null;
  /**
   * Una sola foto por producto, la que se elige tocando el icono de imagen en
   * «Lo que ofrece».
   *
   * Es la URL pública del objeto en el bucket (`places/{id}/menu/{gen}.webp`),
   * subida por `/api/places/[id]/menu-image`, y **no** un data URL: `menu` viaja
   * entero en el catálogo del home y con los bytes dentro cada plato haría de
   * esa respuesta un despropósito de peso. Opcional porque la mayoría de los
   * productos no lleva foto.
   */
  image?: string;
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
  /**
   * Identificador legible y **estable** del negocio. Es la URL corta del menú
   * (`/m/{slug}`) y la que va dentro de un QR impreso.
   *
   * Se calcula una sola vez, al crear la ficha (`toNewPlaceValues`), y no se
   * recalcula al renombrar: cambiar el slug rompería un QR ya pegado en una mesa.
   * `toPlaceValues` lo ignora a propósito, así que ningún `PATCH` lo mueve.
   */
  slug: string;
  name: string;
  isProject?: boolean;
  category: string;
  /**
   * Nombre del icono Lucide que el dueño eligió para su pin. Vacío o ausente
   * significa «el de mi categoría»; la regla vive en `placeIcon`
   * (`src/lib/places.ts`), no aquí.
   */
  icon?: string;
  /**
   * Logotipo del negocio, en el bucket. Vacío o ausente significa «enseña la
   * portada» y, si tampoco hay fotos, el icono de la categoría. Lo sube el
   * formulario de administración con `LogoUpload`.
   */
  logoUrl?: string;
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
      marcado estructurado y en la tarjeta «Contacto». */
  phone?: string;
  website?: string;
  /* Los tres de la sección «Contacto» del formulario. Opcionales como el resto
     del contacto: media tabla se dio de alta antes de que existieran y
     `undefined` significa «no lo rellenó», que es exactamente lo que la ficha
     entiende para no pintar el botón. */
  /** Teléfono con el que atiende WhatsApp, distinto del `phone` de la ficha. */
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  description: string;
  schedule: string;
  /**
   * Energía de respaldo: qué tiene el negocio para seguir con luz durante un
   * apagón. `null`/ausente significa «el dueño no lo dijo», que no es lo mismo
   * que `"ninguna"` —eso es decirlo y no tener—. Ver `src/lib/energia.ts`,
   * donde vive la regla de cuándo se pinta la etiqueta.
   */
  energiaRespaldo?: EnergiaRespaldo | null;
  /**
   * Frase corta del dueño sobre cómo lo lleva durante los apagones. Opcional, y
   * sin ella la etiqueta de energía se sostiene sola.
   */
  notaApagon?: string;
  /**
   * Ambiente del lugar («Tranquilo», «Musical», «Céntrico»). La base ya lo
   * guardaba desde la primera siembra y el mapeo no lo pasaba, así que los
   * filtros del mapa no tenían con qué filtrar.
   */
  vibe?: string[];
  payments: string[];
  menu: UserPlaceMenuItem[];
  offer: UserPlaceOffer | null;
  offerPackages?: ProjectOfferPackage[];
  status: PlaceStatus;
  /**
   * Si el negocio quiere pedidos por WhatsApp en su carta.
   *
   * Es **el interruptor del dueño**, no el permiso: la función la enciende el
   * plan (`whatsapp_pedido`, Básico+) y esto la apaga cuando al negocio no le
   * conviene ese día. Los dos tienen que estar en «sí» para que el carrito
   * aparezca en `/m/{slug}`. Ver `src/lib/plans.ts` y la página del menú.
   */
  pedidosWhatsapp: boolean;
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
  reviewStatus: PlaceReviewStatus;
  isBoosted: boolean;
  boostExpiresAt: string;
  rating?: number;
  /** Vacío o ausente = el negocio todavía no tiene fotos subidas. */
  photos?: UserPlacePhoto[];
  /** Foto elegida para el pin del mapa; en negocios cae a la portada. */
  mapImageUrl?: string | null;
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
   y no suya.

   `pedidosWhatsapp` se queda fuera del todo —ni en el `Omit` ni en el
   `Partial`—: no lo elige quien da de alta el negocio, y sin declararlo no se
   le exige. Lo pone el `default` de la columna. */
export type NewUserPlace = Omit<
  UserPlace,
  "id" | "slug" | "createdAt" | "updatedAt" | "status" | "isActive" | "reviewStatus" | "isBoosted" | "boostExpiresAt" | "pedidosWhatsapp"
> &
  Partial<Pick<UserPlace, "status" | "isActive" | "isBoosted" | "boostExpiresAt">>;

export type UserPlacePatch = Partial<
  Omit<UserPlace, "id" | "createdAt" | "updatedAt">
>;

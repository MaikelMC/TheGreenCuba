import type { UserPlace } from "@/lib/places-store";

/**
 * Un negocio de mentira, para ver la app sin ensuciar la base.
 *
 * Existe solo en desarrollo (`NODE_ENV !== "production"`), y no llega a Postgres
 * nunca: se inyecta al leer, en `listPlaces` y `getPlaceById`. Se probó al
 * revés —una fila más en `places`, sembrada por un script— y es peor por dos
 * motivos: la rama de Neon es la misma que usa el resto del equipo, así que el
 * negocio fantasma acabaría saliendo en el mapa de producción, y borrarlo es
 * otro viaje a la base para deshacer algo que no hacía falta escribir.
 *
 * Aquí borrarlo es borrar este archivo.
 *
 * Lo que **no** cubre: la búsqueda por lenguaje natural, que ordena por el
 * vector `embedding` de `places` y este negocio no tiene fila donde guardarlo.
 */
export const DEV_PLACE_ID = "dev-cafe-la-ceiba";

/**
 * Las fechas del fixture, fijas y no `Date.now()`.
 *
 * Una oferta flash se decide por fecha, así que el fixture necesita fechas para
 * enseñar el tachado —y una ya caducada, para poder ver que el panel la conserva
 * y la ficha no la pinta—. Escritas a mano y no calculadas: el diff de este
 * archivo no puede cambiar solo, y una oferta de prueba que caducara en una
 * semana dejaría de probar nada el mes que viene.
 */
const ENERO_2026 = 1767225600000;
const JUNIO_2026 = 1782782400000;
const ANIO_2100 = 4102444800000;

/** El nombre de la categoría tiene que existir en `BUSINESS_CATEGORIES`. */
export function devPlaceEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Las cuentas que ven este negocio **en producción**.
 *
 * Fuera de desarrollo la ficha no existe para nadie: `devPlaceEnabled()` apaga
 * la inyección entera. Esta lista es la única excepción, y es para poder abrir
 * la ficha y la carta contra datos reales sin que el negocio de mentira acabe
 * en el catálogo de nadie más.
 *
 * Es un literal y no una variable de entorno a propósito: una variable más es
 * una cosa más que puede quedar sin poner en el despliegue, y el fallo entonces
 * es mudo —«no sale la ficha y no sé por qué»—. Esto no es un secreto, es un
 * interruptor.
 *
 * Lo que abre, además: **la carta, a todo el mundo**. No es una excepción a
 * esta lista sino lo contrario —la carta es lo que se reparte, por WhatsApp o
 * en un QR pegado a una mesa, y un menú que solo abre su dueño no se puede
 * repartir—. Su enlace no lleva sesión: lo decide el propio menú, en
 * `m/[slug]/page.tsx`.
 *
 * Lo que abre **además, y solo para** estas cuentas: el pin en el mapa y el
 * negocio en el home. El catálogo es público y no pregunta por la sesión, pero
 * `/api/places` sí mira —y solo cuando la petición trae cookie de sesión, que
 * para un anónimo es no mirar nada— para poder colar este negocio en la lista de
 * quien lo mantiene. Así se prueba el mapa en producción con datos de verdad
 * alrededor.
 *
 * Lo que **no** abre: la ficha (solo estas cuentas, y `sitemap` no la ve
 * nunca). A la ficha se llega por la URL.
 */
const DEV_PLACE_VIEWERS = ["maikelcanario0@gmail.com"];

/** ¿Este correo puede ver el negocio de desarrollo? */
export function canViewDevPlace(email: string | null | undefined): boolean {
  if (devPlaceEnabled()) return true;
  return ownsDevPlace(email);
}

/**
 * ¿Este correo es el **dueño** del negocio de prueba?
 *
 * Es distinto de `canViewDevPlace`, y la diferencia es la que separa «ver» de
 * «ser tuyo»:
 *
 * - `canViewDevPlace` responde a «¿se puede ver el fixture **aquí**?». En
 *   desarrollo dice que sí a todo el mundo, porque el fixture existe para eso
 *   —verlo sin montar nada, ni cuenta—.
 * - Esta responde a «¿este negocio es **suyo**?», y ahí el entorno no pinta
 *   nada: la lista de arriba es la respuesta entera, en local y en producción.
 *
 * La usan las puertas que deciden **propiedad**, no visibilidad: el panel
 * (`/business`), `/api/me` y `canManagePlace`. Antes esas tres miraban a
 * `canViewDevPlace`, así que en desarrollo cualquier cuenta veía el negocio de
 * prueba como propio — le salía en el selector de negocios y podía editarlo—.
 * Ver un negocio y llevarlo no son lo mismo, y aquí no pueden confundirse.
 */
export function ownsDevPlace(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && DEV_PLACE_VIEWERS.includes(normalized));
}

/**
 * Lo mismo, con la sesión delante: es lo que llaman las páginas.
 *
 * El `id` va de parámetro para poder salir antes de preguntar por el usuario.
 * Leer la sesión cuesta un viaje a Neon, y esto se llama en la ficha pública:
 * sin esta salida, cada visita anónima a cualquier negocio lo pagaría.
 */
export async function mayViewDevPlace(id: string): Promise<boolean> {
  if (id !== DEV_PLACE_ID) return false;
  if (devPlaceEnabled()) return true;
  /* La sesión se importa **aquí** y no arriba: `auth/user` arrastra la base y la
     configuración de Neon, que exigen variables de entorno al cargar. Con el
     import estático, este archivo no se podía importar sin montar todo eso, y
     sus funciones puras (`ownsDevPlace`, `devPlaceEnabled`, `devPlace`) no se
     podían probar —que es justo lo que hace `dev-place.test.ts`—. El coste es
     cero: en desarrollo se sale antes por la línea de arriba y en producción la
     resolución del import se resuelve una vez. */
  const { getAppUser } = await import("@/lib/auth/user");
  const user = await getAppUser();
  return canViewDevPlace(user?.email);
}

/**
 * ¿Esta ficha puede entrar en el índice de un buscador?
 *
 * La del negocio de prueba, nunca: fuera de desarrollo es una ficha privada a
 * la que se llega por URL, y una URL que se filtre —o que alguien comparta—
 * metería un negocio de mentira en Google con su marcado estructurado y todo.
 * En desarrollo da igual, no la rastrea nadie.
 */
export function devPlaceIndexable(id: string): boolean {
  return id !== DEV_PLACE_ID || devPlaceEnabled();
}

/**
 * La ficha de mentira, ya construida.
 *
 * **Sin guarda propia**, y es a propósito: quién puede verla lo deciden
 * `mayViewDevPlace` y `devPlaceEnabled` en `queries.ts`, que es donde se sabe
 * si hay sesión. Aquí solo están los datos.
 */
export function devPlace(): UserPlace {
  return {
    id: DEV_PLACE_ID,
    /* El mismo valor que el id: es un negocio que no vive en la base, así que
       `getPlaceBySlug` lo resuelve comparando contra `DEV_PLACE_ID` y la URL
       `/m/${DEV_PLACE_ID}` funciona sin tocar ninguna fila. */
    slug: DEV_PLACE_ID,
    name: "Café La Ceiba (local)",
    category: "Cafetería",
    icon: "Coffee",
    lat: 23.1367,
    lng: -82.3595,
    address: "Calle Ánimas 452, entre Manrique y San Nicolás",
    barrio: "Centro Habana",
    city: "La Habana",
    province: "La Habana",
    phone: "+53 7 862 4410",
    whatsapp: "+53551234567",
    instagram: "@cafélaceiba",
    description:
      "Cafetería de barrio con tostado propio y una terraza en el patio. " +
      "Ficha de prueba: solo la ve quien corre el proyecto en su máquina.",
    schedule: "Todo el día",
    vibe: ["Tranquilo", "Con música"],
    payments: ["Efectivo (CUP)", "Efectivo (MLC)", "Transferencia"],
    /* Cuatro categorías y doce entradas a propósito: es lo que hace falta para
       ver la barra de filtros de la carta —que solo aparece con más de una— y
       para que «Lo que ofrece» de la ficha tenga tres páginas que paginar. */
    menu: [
      {
        /* Con `id` porque lleva encima una oferta flash: es a este `id` al que
           apunta `ofertas[].productoId`, y sin él el tachado no tendría a qué
           agarrarse. El resto de la carta va sin `id`, que es como nace lo que
           escribe el dueño hasta que le cuelga una oferta. */
        id: "cafe-casa",
        name: "Café de la casa",
        description: "Tostado aquí, molido al momento.",
        price: "150",
        currency: "CUP",
        tag: "Popular",
        category: "Cafés",
      },
      {
        name: "Colada",
        description: "Para llevar en termo.",
        price: "400",
        currency: "CUP",
        category: "Cafés",
        /* Agotado con fecha de vuelta ya pasada: se lee como disponible, que es
           justo lo que comprueba `estaAgotado`. */
        disponibilidad: "agotado",
        agotadoHasta: 1,
      },
      {
        name: "Cortadito",
        description: "Mitad café, mitad leche evaporada.",
        price: "200",
        currency: "CUP",
        category: "Cafés",
      },
      {
        name: "Café con leche",
        description: "En taza grande, con leche de vaca.",
        price: "250",
        currency: "CUP",
        category: "Cafés",
      },
      {
        id: "sandwich-jamon",
        name: "Sándwich de jamón",
        description: "Pan de la panadería de enfrente.",
        price: "2.50",
        currency: "MLC",
        category: "Para picar",
      },
      {
        name: "Croqueta de jamón",
        description: "Frita al momento, dos por ración.",
        price: "120",
        currency: "CUP",
        category: "Para picar",
      },
      {
        name: "Tostada con mantequilla",
        description: "Pan de flauta a la plancha.",
        price: "180",
        currency: "CUP",
        category: "Para picar",
      },
      {
        name: "Flan de la casa",
        description: "Con caramelo de la olla, cuajado de un día.",
        price: "350",
        currency: "CUP",
        tag: "Nuevo",
        category: "Dulces",
        /* Agotado sin fecha de vuelta: sigue en la carta, apagado. */
        disponibilidad: "agotado",
      },
      {
        name: "Tortica de chocolate",
        description: "Bizcocho húmedo, sin relleno.",
        price: "2",
        currency: "MLC",
        category: "Dulces",
      },
      {
        name: "Refresco",
        description: "Lata fría, varias marcas.",
        price: "250",
        currency: "CUP",
        category: "Bebidas frías",
      },
      {
        name: "Jugo natural",
        description: "Del día: mango, guayaba o fruta bomba.",
        price: "3",
        currency: "MLC",
        category: "Bebidas frías",
      },
      {
        /* Sin precio a propósito: es el caso de un servicio, y enseña que la
           fila se sostiene con la categoría sola. Ver `MenuItem`. */
        name: "Wi-Fi gratis",
        description: "Contraseña en el mostrador.",
        price: "",
        currency: "CUP",
        category: "Servicios",
      },
    ],
    offer: {
      text: "Dos cafés por el precio de uno, de 3 a 5 de la tarde.",
      expiry: "31 de diciembre, 2026",
    },
    /* Dos vivas y una caducada: la primera prueba el tachado por porcentaje, la
       segunda el precio escrito a mano, y la tercera que el panel conserva lo
       que la ficha ya no pinta. */
    ofertas: [
      {
        id: "oferta-cafe",
        productoId: "cafe-casa",
        titulo: "Café de la casa, 20% menos",
        descripcion: "Solo por la mañana, hasta agotar el tostado del día.",
        descuentoPct: 20,
        inicia: ENERO_2026,
        termina: ANIO_2100,
      },
      {
        id: "oferta-sandwich",
        productoId: "sandwich-jamon",
        titulo: "Sándwich a 2 USD",
        precioOferta: "2",
        inicia: ENERO_2026,
        termina: ANIO_2100,
      },
      {
        id: "oferta-caducada",
        productoId: "cafe-casa",
        titulo: "Colada rebajada (ya terminó)",
        descripcion: "Se quedó aquí para poder reutilizarla cambiándole la fecha.",
        descuentoPct: 30,
        inicia: ENERO_2026,
        termina: JUNIO_2026,
      },
    ],
    status: "active",
    /* El fixture nace con los pedidos encendidos, como cualquier ficha: el
       interruptor vive en Ajustes y su dueño lo apaga desde ahí si quiere ver
       cómo queda la carta sin carrito. */
    pedidosWhatsapp: true,
    /* El fixture nace con las reservas encendidas y tipo mesa, para poder ver el
       botón en cuanto se le ponga plan Pro desde el panel; en Gratis no se pinta
       aunque estén encendidas. Ver `conSelloVerificado`. */
    aceptaReservas: true,
    tipoReserva: "mesa",
    aforoMaxPersonas: 8,
    isActive: true,
    reviewStatus: "approved",
    /* Nace verificado para poder probar el sello **sin tocar la columna**: con
       el plan del fixture en Gratis no se pinta, y al subirlo a Básico o Pro
       desde el panel aparece. Es el camino más corto para ver la regla entera
       —verificado y plan— funcionando. Ver `conSelloVerificado` en
       `dev-place-server.ts`, que es quien resuelve `selloVerificado`. */
    verificado: true,
    isBoosted: false,
    boostExpiresAt: "",
    rating: 4.9,
    priceLabel: "1–3 USD",
    aiTags: ["Café de especialidad", "Terraza", "Barrio"],
    photos: [],
    /* Fecha fija y no `Date.now()`: así el orden del catálogo no baila entre
       recargas y el diff de este archivo no cambia solo. */
    createdAt: 1767225600000,
    updatedAt: 1767225600000,
  };
}

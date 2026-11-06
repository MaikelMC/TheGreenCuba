import {
  pgTable,
  text,
  doublePrecision,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  vector,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { categories } from "./categories";
import { users } from "./users";
import type { Acciones } from "@/lib/ficha/acciones";
import type { EntregaConfig } from "@/lib/ficha/entrega";
import type { Horario } from "@/lib/ficha/horario";
import {
  CATALOGO_FUENTES,
  EXISTENCIAS_MODOS,
  PORTADA_ENCUADRES,
  TIPOS_NEGOCIO,
  type ComoAtiende,
  type ComoComprar,
  type EspecialDelDia,
  type MenuCategoria,
  type ModuloFicha,
} from "@/lib/ficha/tipos";
import type { Disponibilidad } from "@/lib/disponibilidad";

export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    shortDescription: text("short_description"),

    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),

    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),

    address: text("address"),
    city: text("city").notNull(),
    province: text("province").notNull(),
    neighborhood: text("neighborhood"),

    phone: text("phone"),
    website: text("website"),
    /* ── Contacto: lo que el dueño rellena en la sección «Contacto» ──
       Los cuatro son texto y no tienen validación en la base a propósito: un
       sitio web sin protocolo, un @ de Instagram o un teléfono cubano se
       escriben de mil formas y quien los normaliza es la ficha al pintarlos
       (`src/lib/contact-links.ts`), no la columna. */
    /** Teléfono con el que el dueño atiende WhatsApp, no el de la ficha. */
    whatsapp: text("whatsapp"),
    /** Usuario o URL completa («@laverde» / "https://instagram.com/laverde"). */
    instagram: text("instagram"),
    /** URL o nombre de la página (".../laverde" / "laverde"). */
    facebook: text("facebook"),
    // denormalized hours JSON for quick reads
    hoursJson:
      jsonb("hours_json").$type<
        Record<string, { open: string; close: string } | null>
      >(),

    paymentMethods: text("payment_methods").array(),
    currencies: text("currencies").array(),
    priceLevel: integer("price_level").default(1),

    vibe: text("vibe").array(),
    tags: text("tags").array(),

    features: jsonb("features").$type<{
      wifi?: boolean;
      terraza?: boolean;
      petFriendly?: boolean;
      vegetarian?: boolean;
      enchufes?: boolean;
      aireAcondicionado?: boolean;
      musica?: boolean;
      estacionamiento?: boolean;
      [key: string]: boolean | undefined;
    }>(),

    imageUrls: text("image_urls").array(),

    /* ── Energía de respaldo ────────────────────────────────────────────
       En Cuba un apagón es el clima, no una avería, y «¿tienen corriente?» es
       la pregunta que hoy se hace negocio por negocio. Va en columna y no en
       el jsonb `features` —donde ya hay un `enchufes` booleano— porque el
       buscador filtra por ella: un `where` sobre jsonb obliga a un índice
       aparte y a conocer la forma del JSON en SQL, mientras que aquí es una
       comparación de texto y un `in`.

       Nullable y **sin `default`**: `null` es «no lo dijo» y `ninguna` es «lo
       dijo y no tiene». Media tabla se dio de alta antes de que esto existiera
       y marcarlas a `ninguna` habría convertido un hueco en una afirmación
       falsa —y la ficha anuncia lo que dice el dueño, no lo que supone el
       sistema—. Ver `src/lib/energia.ts`. */
    energiaRespaldo: text("energia_respaldo", {
      enum: ["ninguna", "planta", "inversor", "ambas"],
    }),
    /** Frase corta del dueño sobre cómo lo lleva («La planta solo cubre el
        salón», «Los apagones de la noche los pasamos con el inversor»).
        Opcional: la mayoría no la escribe y sin ella la etiqueta se sostiene. */
    notaApagon: text("nota_apagon"),

    /* ── Campos que la UI edita y que antes no tenían dónde ir ──
       Sin estas columnas, el formulario del admin dejaba guardar y al recargar
       se perdía lo escrito, porque el mapeo a la base no tenía destino. */

    /** Icono Lucide del pin de ESTE negocio. Vacío = el de su categoría. */
    icon: text("icon"),
    /** Logotipo del negocio, en el bucket. Vacío = se enseña la portada, o el
        icono de la categoría si tampoco hay fotos. Lo pinta `LogoUpload` desde
        el formulario de administración, y lo usan el círculo de la ficha, la
        miniatura de las tarjetas y el disco del pin. */
    logoUrl: text("logo_url"),
    /** Franja horaria tal como la escribe el dueño («De noche», «Todo el día»). */
    schedule: text("schedule"),
    offerText: text("offer_text"),
    /* Texto libre, no `timestamp`: el campo es un input normal con placeholder
       «Ej: 31 de agosto, 2026». Una fecha así no entra en un `timestamp`. */
    offerExpiry: text("offer_expiry"),
    /** Carta del negocio. Va en jsonb y no en `place_menu_items` porque el
        precio es texto libre («3–5 USD») y esa tabla lo tiene como `double
        precision`: guardarlo ahí perdería lo que el dueño escribió. */
    menu: jsonb("menu").$type<
      {
        /** Identificador estable del producto. Ver `UserPlaceMenuItem`. */
        id?: string;
        name: string;
        description: string;
        price: string;
        currency: string;
        /** «Hoy hay». Los dos campos viven en el jsonb, no en columnas: los
            productos son entradas de la carta, no filas de una tabla. */
        disponibilidad?: Disponibilidad;
        agotadoHasta?: number | null;
        /**
         * Fuera de la carta pública sin borrarlo. Es un booleano y no un tercer
         * valor de `disponibilidad` porque ese tipo lo comparten el asistente
         * y el panel, que solo conocen disponible/agotado: ampliarlo obligaría
         * a tocar media app para un estado que se resuelve antes de pintar.
         */
        oculto?: boolean;
        /** Producto resaltado en la ficha (va primero dentro de su categoría). */
        destacado?: boolean;
        /** Duración del servicio, en minutos. Solo lo usa el módulo servicios. */
        duracionMin?: number;
        /** Cómo se lee el precio: cifra fija, «desde» o «a consultar». */
        tipoPrecio?: "fijo" | "desde" | "consultar";
        /** Existencias exactas. Solo se pinta con `existencias_modo = exacta`. */
        stock?: number;
        /** Identificador en el ERP del negocio, para la futura sincronización. */
        externalId?: string;
        /** Chapita del producto («Popular», «Nuevo», «2x1»). El panel ya la
            guardaba y el tipo no la declaraba, así que quien lo leyera con
            TypeScript no podía saber que estaba ahí. `$type` no genera
            migración: es solo el tipo del jsonb. */
        tag?: string;
        /** Familia del producto («Entrantes», «Bebidas»). Ver
            `UserPlaceMenuItem`. Opcional como `tag`: solo el tipo del jsonb. */
        category?: string;
        /** URL de la foto del producto en el bucket. Opcional: la mayoría de
            los productos no lleva. Como `tag`, es solo el tipo del jsonb —
            jsonb no tiene esquema, así que no hay migración que generar. */
        image?: string;
        /** Marca de la importación por CSV que lo creó. `undefined` = a mano.
            Igual que `tag` e `image`: solo el tipo del jsonb, sin migración. */
        importacionId?: string;
      }[]
    >(),
    /** Valoración media. Denormalizada a propósito: las reseñas viven en
        `reviews`, pero el catálogo se pinta sin consultarlas. */
    rating: doublePrecision("rating"),
    priceLabel: text("price_label"),
    aiTags: text("ai_tags").array(),

    embedding: vector("embedding", { dimensions: 1024 }),

    isActive: boolean("is_active").default(true).notNull(),
    reviewStatus: text("review_status", { enum: ["pending", "approved", "rejected"] })
      .default("approved")
      .notNull(),
    isBoosted: boolean("is_boosted").default(false).notNull(),
    /* `text` y no `timestamp`: el formulario recoge el texto libre que escribe
       el dueño («31 de agosto, 2026») y nada del código calcula con esta fecha.
       Con `timestamp` la escritura fallaba o guardaba basura. */
    boostExpiresAt: text("boost_expires_at"),
    status: text("status", { enum: ["active", "closed", "temporary_closed"] })
      .default("active")
      .notNull(),

    /* ── Pedidos por WhatsApp ──────────────────────────────────────────
       El plan (`whatsapp_pedido`: módulo Pedidos y reservas, o un pack)
       **enciende** la función; esto es el
       interruptor del dueño para apagarla en su carta sin bajar de plan. Son
       dos cosas distintas a propósito: el plan es lo que se paga y esto es lo
       que el negocio quiere hoy —un día sin existencias, unas vacaciones—.

       Nace en `true` y por eso lleva `default`: quien paga la función la
       quiere, salvo que diga lo contrario, y así el día de la migración las
       fichas que ya tenían plan no se quedan apagadas sin que nadie lo pidiera.
       El tope sigue estando arriba: sin el plan, esto no importa. */
    pedidosWhatsapp: boolean("pedidos_whatsapp").default(true).notNull(),

    /* ── Reservas por WhatsApp ─────────────────────────────────────────
       Misma pareja que los pedidos: el plan (`reservas_whatsapp`, Pro)
       **enciende** la función y `acepta_reservas` es el interruptor del dueño
       para apagarla sin bajar de plan. Sin plan no se enseña el botón y el
       panel lo pinta bloqueado; con plan y el interruptor encendido, quien
       mira la ficha arma un mensaje y lo manda por WhatsApp.

       `acepta_reservas` nace en `false` y por eso lleva `default`: al revés que
       los pedidos —donde el carrito es aditivo— una reserva es un compromiso, y
       la migración no puede encender reservas en fichas que nunca las pidieron.
       El dueño las activa desde Ajustes, que es donde se elige el tipo.

       `tipo_reserva` decide el botón —«Reservar mesa», «Apartar», «Pedir
       cita»— y qué pide el formulario: personas, un producto y su cantidad, o
       solo la cita. `aforo_max_personas` es opcional: `null` = sin tope, y solo
       se usa con `mesa`.

       `aforo_diario_personas` es el cupo del día: cuántas personas admite el
       local **en total** para una misma fecha, no por reserva. `null` = sin
       tope, y como `aforo_max_personas` solo se usa con `mesa`, que es el único
       tipo donde el cliente dice cuántas personas vienen. Lo que va ocupando
       vive en `reservas_dias` —una fila por negocio y fecha—, así que el cupo
       se recarga solo al cambiar el día y el dueño puede liberarlo a mano desde
       el panel. Ver `src/lib/reservas-server.ts`.

       `plantilla_reserva` guarda el mensaje del dueño, con {nombre} {fecha}
       {hora} {personas} como huecos. `null`/vacío = la plantilla por defecto,
       que se resuelve al armar el mensaje (`src/lib/reserva.ts`), no aquí. */
    aceptaReservas: boolean("acepta_reservas").default(false).notNull(),
    tipoReserva: text("tipo_reserva", { enum: ["mesa", "apartado", "cita"] })
      .default("mesa")
      .notNull(),
    aforoMaxPersonas: integer("aforo_max_personas"),
    aforoDiarioPersonas: integer("aforo_diario_personas"),
    plantillaReserva: text("plantilla_reserva"),

    /* ── Ficha por tipo ─────────────────────────────────────────────────
       El tipo principal y los módulos son cosas distintas: el tipo dice de
       qué va el negocio y solo siembra valores por defecto; los módulos son
       los bloques que la ficha enciende uno a uno. Todo nace `null` o vacío y
       sin `default` engañoso: una ficha anterior a esta columna no empieza a
       enseñar bloques que su dueño no eligió.

       Las claves están en `src/lib/ficha/tipos.ts` y la validación en el
       `PATCH`; aquí solo se declara la forma. */
    tipoNegocio: text("tipo_negocio", { enum: TIPOS_NEGOCIO }),
    modulosActivos: text("modulos_activos")
      .array()
      .$type<ModuloFicha[]>()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Claves del catálogo de `src/lib/ficha/atributos.ts`, no texto libre. */
    atributos: text("atributos")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Color de marca de la paleta cerrada; `null` = sin color elegido. */
    colorMarca: text("color_marca"),
    portadaEncuadre: text("portada_encuadre", { enum: PORTADA_ENCUADRES }),
    /** Orden y composición de las acciones (fila y barra fija). */
    acciones: jsonb("acciones").$type<Acciones>(),
    /** Horario estructurado. `null` = ficha antigua, se usa `schedule`. */
    horario: jsonb("horario").$type<Horario>(),
    /** Mensaje del cierre temporal. `null` = el texto por defecto del sistema. */
    cerradoMensaje: text("cerrado_mensaje"),
    /** Tarjeta de domicilio: costo, tiempo y pedido mínimo. */
    entrega: jsonb("entrega").$type<EntregaConfig>(),
    /** Cómo se compra en una tienda: recoger y/o apartar. */
    comoComprar: jsonb("como_comprar").$type<ComoComprar>(),
    /** Cómo atiende un servicio: con cita, sin cita, a domicilio. */
    comoAtiende: jsonb("como_atiende").$type<ComoAtiende>(),
    /** El especial del día, con fecha de fin. */
    especialDia: jsonb("especial_dia").$type<EspecialDelDia>(),
    /** Título de la sección de catálogo; `null` = el del tipo. */
    catalogoTitulo: text("catalogo_titulo"),
    /** Orden de las categorías de la carta. */
    menuCategorias: jsonb("menu_categorias").$type<MenuCategoria[]>(),
    existenciasModo: text("existencias_modo", { enum: EXISTENCIAS_MODOS })
      .default("disponible")
      .notNull(),
    /** Cuándo cambió el catálogo. Se escribe solo cuando cambia `menu`. */
    catalogoActualizadoEn: timestamp("catalogo_actualizado_en"),
    /** `manual` = lo edita el dueño; `erp` lo reserva el sincronizador futuro. */
    catalogoFuente: text("catalogo_fuente", { enum: CATALOGO_FUENTES })
      .default("manual")
      .notNull(),
    /** Reseña que el negocio elige para destacar. Validada en la ruta. */
    resenaDestacadaId: text("resena_destacada_id"),
    /** Plantilla del mensaje de pedido, con los mismos huecos que el actual. */
    plantillaPedido: text("plantilla_pedido"),

    /* ── Tasa del día ───────────────────────────────────────────────────
       El dueño fija el precio de sus productos en USD y la carta los
       convierte a CUP con esta tasa. `tasa_activa` es el interruptor:
       falso = la carta se ve igual que siempre. `tasa_redondeo` redondea
       el resultado hacia arriba al múltiplo elegido (1, 5, 10, 50, 100).
       `tasa_actualizada_en` es para el aviso «tu tasa es de ayer». */
    tasaUsdCup: doublePrecision("tasa_usd_cup"),
    tasaActualizadaEn: timestamp("tasa_actualizada_en"),
    tasaRedondeo: integer("tasa_redondeo").default(5).notNull(),
    tasaActiva: boolean("tasa_activa").default(false).notNull(),

    /* ── Sello de negocio verificado ────────────────────────────────────
       Lo enciende **solo la administración**: la lista blanca del `PATCH`
       (`toPlaceValues`) lo mapea y la ruta lo tira si quien escribe no es
       admin, igual que `isActive` y `reviewStatus`. El dueño no puede
       ponerse el sello a sí mismo.

       `default false` y `notNull`, a diferencia de `energiaRespaldo`: aquí
       `false` no afirma nada sobre el negocio, solo dice que nadie lo ha
       verificado todavía —y eso es cierto para toda la tabla anterior a
       esta columna—.

       La columna **no decide si el sello se pinta**: eso lo cierra el plan
       (la función `verificado`: módulo Visibilidad, o un pack). Ver
       `selloVerificado` en el
       mapeo, que es la conjunción de las dos cosas. */
    verificado: boolean("verificado").default(false).notNull(),
    /** Cuándo se verificó. Se sella al encender `verificado` y se borra al
        apagarlo, en `toPlaceValues`; `null` = nunca. */
    verificadoEn: timestamp("verificado_en"),

    /* El plan que eligió el dueño al dar de alta su negocio.
       Nulo a propósito, y sin `default`: solo lo escribe el formulario del
       perfil, así que las fichas de la siembra y las que crea administración
       desde el panel salen con `null`, que significa «aquí nadie eligió plan».
       Ponerle `default 'trial'` habría marcado como «en prueba» medio catálogo
       el día de la migración. */
    plan: text("plan", { enum: ["trial", "paid"] }),

    /* `set null` y no el NO ACTION por defecto: el lugar lo creó alguien que
       puede darse de baja, y borrar esa cuenta no debe impedir el borrado ni
       llevarse por delante el negocio. */
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* Sin `slugIdx`. `slug` ya lleva `.unique()` y Postgres crea un índice único
       para respaldarlo —`places_slug_unique`—, así que el de apoyo no acelera
       ninguna lectura: el único hace el mismo trabajo. Sí cuesta en cada
       `insert`, y se contaba dos veces. */
    categoryIdx: index("places_category_idx").on(table.categoryId),
    cityIdx: index("places_city_idx").on(table.city),
    coordsIdx: index("places_coords_idx").on(table.lat, table.lng),
    activeIdx: index("places_active_idx").on(table.isActive),
    boostedIdx: index("places_boosted_idx").on(table.isBoosted),
    /* `vector_cosine_ops` explícito y no a secas. Sin clase de operadores
       pgvector aplica su DEFAULT para hnsw, que es `vector_l2_ops` (distancia
       L2). El índice se crea igual, sin error, pero la búsqueda ordena por `<=>`
       (coseno): un índice L2 no sirve para eso, Postgres lo ignora y hace un
       seq scan. El único síntoma es lo lento que va, así que se queda puesto
       para siempre. */
    embeddingIdx: index("places_embedding_idx").using(
      "hnsw",
      sql`${table.embedding} vector_cosine_ops`,
    ),
  }),
);

export const placeRelations = relations(places, ({ one, many }) => ({
  category: one(categories, {
    fields: [places.categoryId],
    references: [categories.id],
  }),
  images: many(placeImages),
  hours: many(placeHours),
  menuItems: many(placeMenuItems),
  reviews: many(reviews),
  savedBy: many(savedPlaces),
  businessOwners: many(businessOwners),
  createdByUser: one(users, {
    fields: [places.createdBy],
    references: [users.id],
  }),
}));

import { placeImages } from "./place_images";
import { placeHours } from "./place_hours";
import { placeMenuItems } from "./place_menu_items";
import { reviews } from "./reviews";
import { savedPlaces } from "./saved_places";
import { businessOwners } from "./business_owners";

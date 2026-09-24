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

    /* ── Campos que la UI edita y que antes no tenían dónde ir ──
       Sin estas columnas, el formulario del admin dejaba guardar y al recargar
       se perdía lo escrito, porque el mapeo a la base no tenía destino. */

    /** Icono Lucide del pin de ESTE negocio. Vacío = el de su categoría. */
    icon: text("icon"),
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
        name: string;
        description: string;
        price: string;
        currency: string;
        /** Chapita del producto («Popular», «Nuevo», «2x1»). El panel ya la
            guardaba y el tipo no la declaraba, así que quien lo leyera con
            TypeScript no podía saber que estaba ahí. `$type` no genera
            migración: es solo el tipo del jsonb. */
        tag?: string;
      }[]
    >(),
    /** Valoración media. Denormalizada a propósito: las reseñas viven en
        `reviews`, pero el catálogo se pinta sin consultarlas. */
    rating: doublePrecision("rating"),
    priceLabel: text("price_label"),
    aiTags: text("ai_tags").array(),

    embedding: vector("embedding", { dimensions: 1024 }),

    isActive: boolean("is_active").default(true).notNull(),
    isBoosted: boolean("is_boosted").default(false).notNull(),
    /* `text` y no `timestamp`: el formulario recoge el texto libre que escribe
       el dueño («31 de agosto, 2026») y nada del código calcula con esta fecha.
       Con `timestamp` la escritura fallaba o guardaba basura. */
    boostExpiresAt: text("boost_expires_at"),
    status: text("status", { enum: ["active", "closed", "temporary_closed"] })
      .default("active")
      .notNull(),

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

import {
  pgTable,
  text,
  doublePrecision,
  timestamp,
  boolean,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    /* El enlace con Neon Managed Auth. Aquella guarda la cuenta —correo y
       contraseña— en su esquema `neon_auth`; esta fila guarda el perfil: dónde
       está el usuario, qué prefiere y qué rol tiene. Aquí no se copia ninguna
       credencial.

       Sustituye a `clerk_id`, que existía para lo mismo y nunca lo llenó nadie
       porque Clerk no llegó a ser dependencia. Nullable por el mismo motivo que
       aquel: una fila puede existir sin cuenta detrás, y el alta escribe
       primero la cuenta y después el perfil. */
    authUserId: text("auth_user_id").unique(),
    email: text("email").notNull(),
    name: text("name"),
    /* El rol vive aquí, y no en la cookie de sesión como antes. Neon no deja
       declararle campos propios al usuario (`createNeonAuth` solo acepta
       `baseUrl`, `cookies`, `logLevel` y `logger`), y el rol decide qué puertas
       se abren, así que tiene que estar donde se pueda consultar y cambiar sin
       tocar la configuración de Neon. Los tres valores son los de siempre. */
    role: text("role").notNull().default("user"),
    imageUrl: text("image_url"),
    /* Teléfono de contacto, opcional. Es el campo que el perfil ya enseñaba y
       que hasta ahora solo vivía en el `localStorage` del navegador: se perdía
       al cambiar de equipo. Lo recoge el alta. */
    phone: text("phone"),
    locationCity: text("location_city"),
    /* Coordenadas y no `text`: guardadas como cadena no se pueden comparar ni
       usar en SQL sin castear en cada consulta, que es justo lo que se hace
       con la ubicación del usuario. */
    locationLat: doublePrecision("location_lat"),
    locationLng: doublePrecision("location_lng"),
    onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
    /* Qué versión de los términos aceptó al darse de alta, y cuándo. Las dos
       van juntas y las escribe el mismo `POST /api/me` que recoge el teléfono.

       Nullable a propósito: las cuentas anteriores a que esto existiera no
       tienen el dato, y no se les puede exigir — se registraron cuando la
       casilla no estaba ahí. Un `notNull` con `default` habría inventado una
       aceptación que nadie dio, que es justo lo contrario de para lo que sirve
       esta columna.

       Se guarda la **última** versión aceptada, no el historial. Si algún día
       hace falta la traza completa, eso es una tabla aparte. */
    termsVersion: text("terms_version"),
    termsAcceptedAt: timestamp("terms_accepted_at"),
    preferences: jsonb("preferences").$type<{
      interests?: string[];
      currencies?: string[];
      moods?: string[];
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    /* Sin `authUserIdIdx`: la columna ya es `.unique()` y el índice único que la
       respalda es el que usa `getAppUser()`. El de apoyo era el mismo índice
       otra vez. */
    emailIdx: index("users_email_idx").on(table.email),
    /* El rol se compara contra tres valores literales en cada guarda de acceso.
       Sin esta restricción, un `update` con una errata («admn») crea un rol que
       no abre nada y cuyo síntoma es un usuario al que no le funciona el panel,
       sin ningún error de por medio. */
    roleCheck: check("users_role_check", sql`${table.role} in ('user', 'owner', 'admin')`),
  }),
);

export const userRelations = relations(users, ({ many }) => ({
  savedPlaces: many(savedPlaces),
  reviews: many(reviews),
  businessOwners: many(businessOwners),
  searchHistory: many(userSearchHistory),
}));

import { savedPlaces } from "./saved_places";
import { reviews } from "./reviews";
import { businessOwners } from "./business_owners";
import { userSearchHistory } from "./user_search_history";

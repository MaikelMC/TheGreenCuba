import {
  pgTable,
  text,
  doublePrecision,
  timestamp,
  boolean,
  jsonb,
  index,
  check,
  type AnyPgColumn,
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
    /* El programa de afiliados. `referral_code` es a la vez la respuesta a «¿es
       afiliado?» y el código que va en su enlace, así que las dos cosas no
       pueden contradecirse. Nullable y no `notNull` con un `false` al lado: el
       estado es la ausencia, y Postgres deja tantos `null` como haga falta bajo
       el índice único.

       Desactivar lo deja a `null`, o sea que **tira el código** y reactivar
       emite uno nuevo. Es lo que se quiere —retirar a alguien tiene que cortarle
       la atribución—; el día que haga falta pausar sin matar un enlace ya
       repartido, eso es un `boolean` más. */
    referralCode: text("referral_code").unique(),
    /* Quién lo trajo, apuntando a otra fila de esta misma tabla. `set null` y no
       `cascade`: que el afiliado borre su cuenta no puede llevarse por delante a
       quien vino por su enlace. */
    referredBy: text("referred_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
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
    /* La lista de «Enlaces» pregunta por los referidos de uno. Sin índice eso es
       un recorrido de la tabla entera cada vez que un afiliado abre su página. */
    referredByIdx: index("users_referred_by_idx").on(table.referredBy),
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

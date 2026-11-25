import {
  boolean,
  pgSchema,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Las tablas de autenticación, en el esquema `neon_auth`.
 *
 * El nombre del esquema es heredado y **no se renombra**: cambiarlo exige una
 * migración en producción sincronizada con el despliegue, y no aporta nada.
 * Better Auth usa estas tablas a través del adaptador de Drizzle, con sus
 * columnas y sus ids de usuario.
 *
 * Este archivo **no se exporta desde `src/lib/db/schema/index.ts`** a propósito.
 * Si entrara ahí, `drizzle-kit generate` lo tomaría por esquema propio e
 * intentaría crear tablas que ya existen en otro esquema. El adaptador las
 * recibe directamente en `src/lib/auth/server.ts`.
 *
 * Las columnas van en camelCase porque así están en la base: es la convención
 * de Better Auth.
 */
const authSchema = pgSchema("neon_auth");

/** `neon_auth.user`: la cuenta de acceso. `public.users` es el perfil. */
export const authUser = authSchema.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  /* Columna heredada, no estándar de Better Auth. Se declara como campo adicional para
     no ignorarla al leer, pero quien manda sobre el rol es `public.users`. */
  role: text("role"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

/** `neon_auth.session`: una fila por sesión abierta. */
export const authSession = authSchema.table("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull(),
});

/** `neon_auth.account`: la contraseña (scrypt) o el vínculo con Google. */
export const authAccount = authSchema.table("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

/** `neon_auth.verification`: códigos de un solo uso y tokens de recuperación. */
export const authVerification = authSchema.table("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

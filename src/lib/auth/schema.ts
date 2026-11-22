import {
  boolean,
  pgSchema,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Las tablas de autenticación, tal como ya existen en `neon_auth`.
 *
 * No son nuestras: las creó Neon Managed Auth y **no se renombran**. Better
 * Auth las usa tal cual a través del adaptador de Drizzle, con las mismas
 * columnas y los mismos ids de usuario, para que las cuentas y las contraseñas
 * que ya hay sigan valiendo después de la migración.
 *
 * Este archivo **no se exporta desde `src/lib/db/schema/index.ts`** a propósito.
 * Si entrara ahí, `drizzle-kit generate` lo tomaría por esquema propio e
 * intentaría crear tablas que ya existen en otro esquema. El adaptador las
 * recibe directamente en `src/lib/auth/server.ts`.
 *
 * Las columnas van en camelCase porque así están en la base: son las que
 * escribió Better Auth 1.6.23 cuando el esquema lo gestionaba Neon.
 */
const neonAuth = pgSchema("neon_auth");

/** `neon_auth.user`: la cuenta de acceso. `public.users` es el perfil. */
export const authUser = neonAuth.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  /* Columna propia de Neon. Better Auth la declara como campo adicional para
     no ignorarla al leer, pero quien manda sobre el rol es `public.users`. */
  role: text("role"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

/** `neon_auth.session`: una fila por sesión abierta. */
export const authSession = neonAuth.table("session", {
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
export const authAccount = neonAuth.table("account", {
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
export const authVerification = neonAuth.table("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

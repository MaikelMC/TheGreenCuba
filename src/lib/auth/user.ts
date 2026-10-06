import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { trackEvent } from "@/lib/analytics/events";
import { auth } from "@/lib/auth/server";
import { ensureContact } from "@/lib/contacts";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { DEV_COOKIE, DEV_IDENTITY, devAccessEnabled, isDevCookie } from "@/lib/dev-access";
import { REFERRAL_COOKIE, referrerIdFor } from "@/lib/referral";
import { generateId } from "@/lib/utils";
import { AUTH_USER_HEADER, type Role } from "@/lib/session";

/**
 * Puente entre la cuenta de Neon y el perfil del proyecto.
 *
 * Son dos cosas distintas y conviene no mezclarlas. Neon Managed Auth guarda
 * **quién eres** —correo y contraseña, en su esquema `neon_auth`— y esta tabla
 * guarda **lo que haces en la app**: tu ciudad, tus preferencias, tu rol y las
 * relaciones con `saved_places`, `reviews` y `business_owners`.
 *
 * Este módulo es el único sitio que conoce a los dos. Todo lo demás —layouts,
 * rutas de API, componentes de servidor— pregunta aquí y recibe un `AppUser`
 * con el vocabulario de la app.
 *
 * La identidad llega del proxy, no de preguntarle a Neon desde aquí. El motivo
 * está entero en `AUTH_USER_HEADER` (`src/lib/session.ts`): dentro del render
 * `auth.getSession()` revienta en cuanto el paquete tiene que devolverle una
 * cookie a Neon, y eso pasa cada vez que falla su caché de sesión. El proxy sí
 * puede escribir cookies, así que resuelve la sesión allí y aquí se lee.
 *
 * En el navegador el estado de sesión se lee con `authClient.useSession()`, que
 * no sabe nada del rol (por eso existe `/api/me`).
 */

export interface AppUser {
  /** Clave primaria de la tabla `users`. Es la que usan las claves foráneas. */
  id: string;
  /** El id en `neon_auth`. Hace falta para leer de allí lo que la app no
      guarda —hoy, si la cuenta viene de Google—. No sale de este proceso. */
  authUserId: string | null;
  email: string;
  name: string;
  imageUrl: string | null;
  /** Opcional. Lo recoge el alta; el perfil lo deja cambiar después. */
  phone: string | null;
  /** Qué versión de los términos aceptó al darse de alta. `null` en las cuentas
      anteriores a que existiera la casilla. */
  termsVersion: string | null;
  role: Role;
  locationCity: string | null;
  onboardingCompleted: boolean;
  /** El código del programa de afiliados. `null` es «no es afiliado»: con él se
      abre la sección «Enlaces» y sin él no existe. */
  referralCode: string | null;
  preferences: {
    interests?: string[];
    moods?: string[];
    currencies?: string[];
  } | null;
}

const ROLES: readonly Role[] = ["user", "owner", "admin"];

/** La columna es `text` a secas, así que el tipo no basta: hay que comprobarlo. */
function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Rol de arranque, por correo:
 *
 *   AUTH_BOOTSTRAP_ROLES="admin@laverde.cu=admin,negocio@laverde.cu=owner"
 *
 * Hace falta un punto de entrada. Neon no deja declarar campos propios en su
 * configuración, así que sin esto no habría forma de que existiera un
 * administrador y `/admin` y `/business` quedarían cerrados para siempre.
 *
 * Se aplica **solo al crear la fila**, la primera vez que esa persona entra.
 * A partir de ahí el rol es un dato más de la tabla y se cambia ahí, no aquí:
 * si esto se releyera en cada arranque, quitarle el rol a alguien en la base no
 * serviría de nada.
 *
 * Es una lista y no dos variables sueltas porque no debe crecer: no es un
 * sistema de permisos, es la cerradura que alguien tiene que abrir la primera
 * vez. Un `ponytail:` de manual — el día que haga falta invitar gente desde el
 * panel, esto sobra.
 */
function bootstrapRole(email: string): Role {
  const table = process.env.AUTH_BOOTSTRAP_ROLES ?? "";
  const wanted = email.trim().toLowerCase();

  for (const entry of table.split(",")) {
    const [mail, role] = entry.split("=").map((part) => part.trim().toLowerCase());
    if (mail && mail === wanted && isRole(role)) return role;
  }
  return "user";
}

interface NeonIdentity {
  id: string;
  email: string;
  name: string;
}

/**
 * Quién dice Neon que eres, o `null`.
 *
 * La cabecera la pone el proxy y siempre está en las rutas que pasan por él
 * —vacía cuando no hay sesión, que es distinto de que no haya cabecera—. Si no
 * está, la petición no pasó por el proxy: son las rutas de API, excluidas del
 * matcher, y esas sí pueden llamar a `auth.getSession()` porque corren en fase
 * `action`.
 */
async function readNeonIdentity(): Promise<NeonIdentity | null> {
  const fromProxy = (await headers()).get(AUTH_USER_HEADER);
  if (fromProxy !== null) {
    if (!fromProxy) return null;
    try {
      return JSON.parse(decodeURIComponent(fromProxy)) as NeonIdentity;
    } catch {
      /* Cabecera ilegible. Mejor quedarse sin sesión que fiarse de un valor
         a medio parsear. */
      return null;
    }
  }

  /* Sin cabecera: o la petición no pasó por el proxy —las rutas de API están
     fuera de su matcher— o es una que no pregunta por el usuario. Antes de
     preguntarle a Neon, la puerta de atrás del desarrollo: si no, entrar con
     `/dev-login` valdría para ver las páginas pero no para las rutas de API,
     que seguirían viendo a nadie y es justo lo que hace que la mitad de la
     interfaz parezca rota. Ver `src/lib/dev-access.ts`. */
  if (devAccessEnabled() && isDevCookie((await cookies()).get(DEV_COOKIE)?.value)) {
    return DEV_IDENTITY;
  }

  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user) return null;
  return { id: user.id, email: user.email ?? "", name: user.name ?? "" };
}

/**
 * El padrino, si el alta llegó con un enlace de afiliado.
 *
 * La cookie la puso el proxy al abrir el enlace y sigue viva treinta días, así
 * que aquí puede estar perfectamente aunque hayan pasado la verificación, el
 * salto a Google y una recarga entera. Sin cookie no hay consulta: la mayoría de
 * las filas se crean sin padrino, y preguntar por el vacío sería un viaje a Neon
 * por cada alta normal.
 */
async function referrerFromCookie(): Promise<string | null> {
  const code = (await cookies()).get(REFERRAL_COOKIE)?.value;
  return code ? referrerIdFor(code) : null;
}

function toAppUser(row: typeof users.$inferSelect): AppUser {
  return {
    id: row.id,
    authUserId: row.authUserId ?? null,
    email: row.email,
    /* `users.name` es opcional en la tabla; el menú lo pinta tal cual y un
       `null` dejaría el hueco en blanco. El correo sin dominio es un nombre
       pobre, pero es un nombre. */
    name: row.name?.trim() || row.email.split("@")[0] || row.email,
    imageUrl: row.imageUrl ?? null,
    phone: row.phone ?? null,
    termsVersion: row.termsVersion ?? null,
    role: isRole(row.role) ? row.role : "user",
    locationCity: row.locationCity ?? null,
    onboardingCompleted: row.onboardingCompleted,
    referralCode: row.referralCode ?? null,
    preferences: row.preferences ?? null,
  };
}

/**
 * El usuario de la app, o `null` si no hay sesión.
 *
 * La primera vez que alguien entra crea su fila. Es un `insert` en una lectura,
 * que normalmente sería un mal negocio, pero la alternativa es un paso de alta
 * aparte que hay que acordarse de llamar en cada sitio nuevo — y el día que se
 * olvide, el fallo es un usuario sin perfil, no un error. Con `onConflictDoNothing`
 * más una relectura, dos peticiones a la vez no se pisan: la segunda encuentra
 * la fila que escribió la primera.
 *
 * No lleva `cache()` de React, aunque parezca el sitio. Esta función se llama
 * tanto desde componentes de servidor —donde `cache()` deduplicaría el layout y
 * su página— como desde rutas de API, que corren **fuera** de un render. Una
 * optimización de una consulta no compensa arriesgarse a que `cache()` se queje
 * justo ahí, porque lo que se caería entonces son todas las rutas de
 * administración a la vez, que pasan por `isAdminRequest`.
 */
export async function getAppUser(): Promise<AppUser | null> {
  const neonUser = await readNeonIdentity();
  if (!neonUser) return null;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.authUserId, neonUser.id))
    .limit(1);

  if (existing) {
    const desiredRole = bootstrapRole(neonUser.email);
    /* La fila puede existir desde antes de que este correo estuviera en
       `AUTH_BOOTSTRAP_ROLES` o antes de que alguien cambiara la configuración.
       Cuando la configuración dice que este correo debe ser `owner` o `admin`,
       el perfil debe corregirse hasta ese valor sin tener que borrar la fila.
       Eso cubre el caso real en que alguien quedó como `owner` pero la
       interfaz de administración le exige `admin`. */
    if (desiredRole !== "user" && existing.role !== desiredRole) {
      const [updated] = await db
        .update(users)
        .set({ role: desiredRole, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning();

      return updated ? toAppUser(updated) : toAppUser(existing);
    }

    return toAppUser(existing);
  }

  const email = neonUser.email;
  /* Se atribuye **aquí**, en la rama que crea la fila, y no en cada camino de
     alta. Esta función es el único sitio por el que pasa todo el mundo la primera
     vez, así que esto cubre por igual el alta con contraseña, la de Google y la
     puerta de atrás del desarrollo, sin tocar ninguna de las tres. Ver
     `src/lib/referral.ts` para de dónde sale el código y por qué se resuelve
     ahora y no cuando llegó. */
  const referredBy = await referrerFromCookie();

  const [created] = await db
    .insert(users)
    .values({
      id: generateId(),
      authUserId: neonUser.id,
      email,
      name: neonUser.name || null,
      role: bootstrapRole(email),
      referredBy,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    /* La fila de `contacts` nace aquí, sin novedades, y no más tarde: es el
       único punto por el que pasa todo el mundo la primera vez —también quien
       entra con Google, que no tiene contraseña—. Quien marque la casilla del
       alta la sube a `true` un segundo después. Y no se deja que un fallo aquí
       tumbe el alta: lo que se pierde es la constancia de una decisión, no la
       cuenta. */
    try {
      await ensureContact(created.id, email);
    } catch (error) {
      console.error("No se pudo crear la fila de contacts:", error);
    }

    /* El alta real. Se registra aquí y no en el formulario porque este es el
       único punto por el que pasa todo el mundo la primera vez —también quien
       entra con Google o por el login de desarrollo—. `after()` no existe
       dentro de un render de servidor, así que `trackEvent` cae al registro
       inmediato: es un alta, no un bucle, y no pasa por cada página. */
    trackEvent({ type: "user_registered", userId: created.id });

    return toAppUser(created);
  }

  /* Se adelantó otra petición entre el `select` y el `insert`. La fila ya está
     escrita; se lee la que ganó. */
  const [raced] = await db
    .select()
    .from(users)
    .where(eq(users.authUserId, neonUser.id))
    .limit(1);

  return raced ? toAppUser(raced) : null;
}

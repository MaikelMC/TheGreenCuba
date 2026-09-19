import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import type { Role } from "@/lib/session";

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
 * Nota que `auth.getSession()` lee la cookie, así que esto solo funciona en el
 * servidor: layouts, componentes de servidor y rutas de API. En el navegador el
 * estado de sesión se lee con `authClient.useSession()`, que no sabe nada del
 * rol (por eso existe `/api/me`).
 */

export interface AppUser {
  /** Clave primaria de la tabla `users`. Es la que usan las claves foráneas. */
  id: string;
  email: string;
  name: string;
  role: Role;
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

function toAppUser(row: typeof users.$inferSelect): AppUser {
  return {
    id: row.id,
    email: row.email,
    /* `users.name` es opcional en la tabla; el menú lo pinta tal cual y un
       `null` dejaría el hueco en blanco. El correo sin dominio es un nombre
       pobre, pero es un nombre. */
    name: row.name?.trim() || row.email.split("@")[0] || row.email,
    role: isRole(row.role) ? row.role : "user",
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
  const { data: session } = await auth.getSession();
  const neonUser = session?.user;
  if (!neonUser?.id) return null;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.authUserId, neonUser.id))
    .limit(1);

  if (existing) return toAppUser(existing);

  const email = neonUser.email ?? "";
  const [created] = await db
    .insert(users)
    .values({
      id: generateId(),
      authUserId: neonUser.id,
      email,
      name: neonUser.name ?? null,
      role: bootstrapRole(email),
    })
    .onConflictDoNothing()
    .returning();

  if (created) return toAppUser(created);

  /* Se adelantó otra petición entre el `select` y el `insert`. La fila ya está
     escrita; se lee la que ganó. */
  const [raced] = await db
    .select()
    .from(users)
    .where(eq(users.authUserId, neonUser.id))
    .limit(1);

  return raced ? toAppUser(raced) : null;
}

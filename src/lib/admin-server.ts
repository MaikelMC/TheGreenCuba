import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAppUser, type AppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { businessOwners } from "@/lib/db/schema";
import { DEV_PLACE_ID, ownsDevPlace } from "@/lib/dev-place";
import {
  normalizarPermisos,
  type PermisoNegocio,
} from "@/lib/permisos-negocio";

/** Clave de administración. Falla en seco si no está configurada (sin fallback). */
export function getAdminKey(): string | null {
  const key = process.env.ADMIN_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

/**
 * Se comparan los `sha256` y no las cadenas en crudo.
 *
 * `timingSafeEqual` exige dos buffers del mismo tamaño, así que comparando el
 * texto tal cual hace falta un `a.length !== b.length` antes, y ese `return`
 * temprano filtra cuánto mide `ADMIN_KEY`: quien pruebe claves de longitud
 * creciente ve cuál es la buena por el tiempo, sin acertar ni un carácter. Un
 * hash mide siempre 32 bytes, así que la comparación recorre lo mismo pase lo
 * que pase y la longitud deja de ser un dato.
 *
 * El coste es un sha256 de una cadena corta, y esta función corre una vez por
 * petición de administración, por detrás de una consulta a la base.
 */
export function isValidAdminKey(key: string): boolean {
  const expected = getAdminKey();
  if (!expected || !key) return false;
  const a = createHash("sha256").update(key).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Quién puede llamar a las rutas de API de administración. Dos caminos, y solo
 * dos:
 *
 * 1. **La sesión.** Es el camino normal desde que `/admin` entra por `/login`:
 *    el navegador manda la cookie, Neon la valida y aquí se mira el rol, que
 *    vive en la tabla `users`.
 * 2. **La cabecera `x-admin-key`.** Se conserva para `curl`, los scripts y los
 *    servicios que ya la usaban. Retirarla rompería a quien no pasa por el
 *    navegador, y no aporta ninguna seguridad a cambio.
 *
 * Sigue siendo `async`, pero ya no por la firma —de eso se encarga Neon— sino
 * porque comprobar el rol es una consulta a la base.
 *
 * Ojo con el orden: la cabecera se comprueba primero y sin tocar la base. Es el
 * camino de los scripts, y no tiene por qué pagar una consulta.
 */
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  if (isValidAdminKey(req.headers.get("x-admin-key") ?? "")) return true;

  const user = await getAppUser();
  return user?.role === "admin";
}

/**
 * Quién puede editar **un negocio concreto**: un administrador o su dueño.
 *
 * Existe porque `isAdminRequest` se queda corto desde que un usuario normal
 * puede dar de alta su negocio. El dueño es `owner`, no `admin`, así que con la
 * comprobación de antes cada guardado de su propia ficha le devolvía un 401:
 * podía registrarse y no podía corregir una errata.
 *
 * Los dos caminos son los mismos que en `isAdminRequest` y por el mismo orden
 * —la cabecera primero, sin tocar la base, porque es el camino de los scripts—.
 * La diferencia es el último paso: en vez de mirar el rol a secas, se busca la
 * fila de `business_owners` que vincula a este usuario con este negocio. El rol
 * `owner` no basta por sí solo: dice que llevas **algún** negocio, no cuál, y
 * con solo eso cualquier dueño podría editar la ficha de cualquier otro.
 *
 * Las dos condiciones de la consulta van en **un solo `where`**, con `and`. En
 * drizzle, encadenar dos `.where()` reemplaza en lugar de combinar, y la segunda
 * sustituiría a la primera: quedaría filtrando solo por negocio y devolviendo la
 * fila de otro dueño como si fuera tuya.
 *
 * El borrado del negocio **no** pasa por aquí. Cerrar una ficha es cosa de
 * administración; que un dueño pueda eliminar su negocio desde el panel es otra
 * decisión y no está tomada.
 */
export interface AccesoNegocio {
  /** El dueño puede todo, incluidos los planes y la gestión del equipo. */
  esDueno: boolean;
  /** Lo que puede tocar un trabajador. El dueño lo ignora: tiene todo. */
  permisos: PermisoNegocio[];
}

/**
 * El acceso de una cuenta a un negocio concreto, o `null` si no tiene ninguno.
 *
 * Es la única consulta que decide «¿puede esta persona tocar este negocio?».
 * Los administradores y el negocio de prueba se resuelven antes de tocar la
 * tabla; para el resto, la fila de `business_owners` manda.
 *
 * El rol `owner` de `users` no entra aquí a propósito: dice que llevas algún
 * negocio, no cuál. La fila concreta es la que abre la puerta.
 */
export async function accesoNegocio(
  user: AppUser,
  placeId: string,
): Promise<AccesoNegocio | null> {
  if (user.role === "admin") return { esDueno: true, permisos: [] };

  /* El negocio de prueba no tiene fila en `business_owners` que consultar: su
     "propiedad" es la lista de cuentas dueñas (`dev-place.ts`). Se pregunta por
     `ownsDevPlace` y no por `canViewDevPlace` a propósito: editar es de quien lo
     lleva, no de quien puede verlo, y en desarrollo `canViewDevPlace` dice que sí
     a cualquiera —así cualquier cuenta con sesión podía escribir en el fixture—. */
  if (placeId === DEV_PLACE_ID) {
    return ownsDevPlace(user.email) ? { esDueno: true, permisos: [] } : null;
  }

  const [row] = await db
    .select({ role: businessOwners.role, permissions: businessOwners.permissions })
    .from(businessOwners)
    .where(and(eq(businessOwners.userId, user.id), eq(businessOwners.placeId, placeId)))
    .limit(1);

  if (!row) return null;

  return {
    esDueno: row.role === "owner",
    permisos: normalizarPermisos(row.permissions),
  };
}

/**
 * ¿Puede esta petición editar este negocio?
 *
 * Con `permiso`, además, un trabajador necesita ese permiso concreto; sin él, la
 * pregunta es la de siempre, «¿este negocio es suyo?», y sirve para las rutas
 * que no se trocean por permiso. El dueño y el administrador pasan siempre.
 */
export async function canManagePlace(
  req: NextRequest,
  placeId: string,
  permiso?: PermisoNegocio,
): Promise<boolean> {
  if (isValidAdminKey(req.headers.get("x-admin-key") ?? "")) return true;

  const user = await getAppUser();
  if (!user) return false;

  const acceso = await accesoNegocio(user, placeId);
  if (!acceso) return false;
  if (acceso.esDueno) return true;
  if (!permiso) return true;

  return acceso.permisos.includes(permiso);
}

/**
 * ¿Es el dueño de este negocio? Para lo que no se delega: planes, pagos,
 * publicaciones y el equipo. Un administrador también pasa.
 */
export async function esDuenoDePlace(
  req: NextRequest,
  placeId: string,
): Promise<boolean> {
  if (isValidAdminKey(req.headers.get("x-admin-key") ?? "")) return true;

  const user = await getAppUser();
  if (!user) return false;
  return (await accesoNegocio(user, placeId))?.esDueno === true;
}

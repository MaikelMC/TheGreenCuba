import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { businessOwners, places, users } from "@/lib/db/schema";
import { TERMS_VERSION } from "@/lib/legal";

/**
 * Nombre del negocio que lleva esta persona.
 *
 * El panel de negocio lo pinta en su cabecera y lo sacaba del campo `business`
 * de la cuenta de demostración, que era una cadena escrita a mano en
 * `src/lib/accounts.ts`. Su origen de verdad es `business_owners`: la fila que
 * dice quién lleva qué sitio.
 *
 * Solo se consulta para los dueños. Un usuario normal —o un administrador— no
 * tiene negocio, y esta ruta la llama el menú de usuario en **cada** página, así
 * que una consulta de más aquí se paga en todas.
 */
export interface AppBusiness {
  id: string;
  name: string;
  /** `false` mientras esté pendiente de que un administrador lo publique. */
  isActive: boolean;
}

async function businessOf(userId: string): Promise<AppBusiness | null> {
  const [row] = await db
    .select({ id: places.id, name: places.name, isActive: places.isActive })
    .from(businessOwners)
    .innerJoin(places, eq(businessOwners.placeId, places.id))
    .where(eq(businessOwners.userId, userId))
    .limit(1);

  return row ?? null;
}

/**
 * El negocio, solo para quien puede tenerlo.
 *
 * La guarda del rol no es adorno: esta ruta la llama el menú de usuario en
 * **cada** página, así que una consulta de más aquí se paga en todas. Un
 * usuario normal no tiene negocio y no hay por qué preguntarlo.
 *
 * `admin` entra también porque el rol y el vínculo son cosas distintas: una
 * administradora puede haber dado de alta su propio negocio y seguir siendo
 * `admin`, y si esto mirara solo `owner` su perfil diría que no tiene ninguno.
 */
async function businessFor(id: string, role: string): Promise<AppBusiness | null> {
  if (role !== "owner" && role !== "admin") return null;
  return businessOf(id);
}

/**
 * Quién ha iniciado sesión, para el menú de usuario.
 *
 * Sustituye a `/api/auth/session`, que leía la cookie firmada. El sitio bajo
 * `/api/auth/` es ahora de Neon —el catch-all `[...path]` monta su manejador
 * entero— y colgarle una ruta propia de la app sería una trampa para quien lo
 * lea después: parece de Neon y no lo es. De ahí el nombre nuevo.
 *
 * Lo que devuelve es el usuario **de la app**, no el de Neon: el rol vive en la
 * tabla `users`, y el cliente de Neon no lo conoce. Es justo lo que el menú
 * necesita para decidir qué enlaces enseñar.
 *
 * Nunca devuelve el token ni la contraseña. Solo lo que la interfaz necesita.
 */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function GET() {
  const user = await getAppUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      phone: user.phone,
      termsVersion: user.termsVersion,
      role: user.role,
<<<<<<< HEAD
      business: await businessFor(user.id, user.role),
=======
      locationCity: user.locationCity,
      onboardingCompleted: user.onboardingCompleted,
      preferences: user.preferences,
      business: user.role === "owner" ? await businessName(user.id) : null,
>>>>>>> bbfc312 (fix: sync profile preferences and admin user management)
    },
  });
}

export async function POST(request: NextRequest) {
  const sessionUser = await getAppUser();

  if (!sessionUser) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const nextName = typeof payload.name === "string" ? payload.name.trim() : null;
  const nextEmail = typeof payload.email === "string" ? payload.email.trim() : null;
  const nextAvatar = typeof payload.avatarUrl === "string" ? payload.avatarUrl : null;
  const nextLocation = typeof payload.location === "string" ? payload.location.trim() : null;
  const nextLocationName = typeof payload.locationName === "string" ? payload.locationName.trim() : null;
  const nextPhone = typeof payload.phone === "string" ? payload.phone.trim() : null;
  const nextOnboarding = typeof payload.onboardingCompleted === "boolean" ? payload.onboardingCompleted : null;
  /* La aceptación de los términos, tal cual la manda el alta. */
  const nextTermsVersion = typeof payload.termsVersion === "string" ? payload.termsVersion.trim() : null;
  const nextInterests = asStringArray(payload.interests);
  const nextMoods = asStringArray(payload.moods);
  const nextCurrencies = asStringArray(payload.currencies);

  const [row] = await db
    .update(users)
    .set({
      name: nextName ?? sessionUser.name,
      email: nextEmail ?? sessionUser.email,
      imageUrl: nextAvatar ?? sessionUser.imageUrl ?? null,
      /* `?? sessionUser.phone` y no `?? null`: el onboarding guarda las
         preferencias sin mandar el teléfono, y con un `null` seco cada paso por
         ahí lo habría borrado. Una cadena vacía sí lo borra —es lo que se manda
         al vaciar el campo en el perfil—; ausente significa «no lo toques». */
      phone: nextPhone ?? sessionUser.phone,
      locationCity: nextLocation ?? nextLocationName ?? null,
      preferences: {
        interests: nextInterests.length > 0 ? nextInterests : undefined,
        moods: nextMoods.length > 0 ? nextMoods : undefined,
        currencies: nextCurrencies.length > 0 ? nextCurrencies : undefined,
      },
      onboardingCompleted: nextOnboarding ?? false,
      /* Solo se sella si la versión que llega es la vigente, y con la hora del
         **servidor**: la del navegador la elige quien acepta, así que una
         constancia con fecha que el cliente controla no prueba nada.

         La comparación con `TERMS_VERSION` es de calidad del dato, no una
         guarda: esta ruta la usan también el perfil y el onboarding, que no
         mandan términos, así que exigirlos aquí rompería el guardado normal. Lo
         de «hay que aceptarlos» lo impone la casilla del alta. Lo que evita esto
         es que la columna acabe siendo un campo que el cliente rellena a su
         gusto, que es lo mismo que no tener nada. */
      ...(nextTermsVersion === TERMS_VERSION
        ? { termsVersion: nextTermsVersion, termsAcceptedAt: new Date() }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, sessionUser.id))
    .returning();

  const user = row ?? (await getAppUser());
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 404 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      phone: user.phone,
      termsVersion: user.termsVersion,
      role: user.role,
<<<<<<< HEAD
      business: await businessFor(user.id, user.role),
=======
      locationCity: user.locationCity,
      onboardingCompleted: user.onboardingCompleted,
      preferences: user.preferences,
      business: user.role === "owner" ? await businessName(user.id) : null,
>>>>>>> bbfc312 (fix: sync profile preferences and admin user management)
    },
  });
}

/**
 * Borrar la cuenta, de verdad.
 *
 * Hasta ahora el botón del perfil solo vaciaba el `localStorage` y cerraba
 * sesión: la fila de `users` y la cuenta de Neon seguían ahí, y el diálogo que
 * pedía confirmación decía que no había servidor donde borrar nada. Con correo,
 * teléfono, ciudad, preferencias, búsquedas y reseñas guardados en la base, eso
 * dejó de ser cierto, y unos términos que prometen supresión no pueden convivir
 * con un botón que no borra.
 *
 * **El orden importa, y es este.** Primero la fila, después la cuenta de Neon:
 *
 * - Al borrar la fila caen en cascada `saved_places`, `reviews`,
 *   `user_search_history` y `business_owners` —las cuatro declaradas con
 *   `onDelete: cascade` sobre `users.id`— y `places.created_by` queda a `null`,
 *   porque el negocio no es de quien lo dio de alta.
 * - Si el segundo paso falla, lo que sobrevive es una cuenta de Neon sin perfil.
 *   Se arregla sola: `getAppUser()` recrea la fila vacía la próxima vez que esa
 *   persona entre, y para entonces no queda ni un dato personal detrás. Al revés
 *   —cuenta primero— un fallo al borrar la fila dejaría los datos en pie justo
 *   después de haber dicho que se borraron, que es el peor final posible.
 *
 * La respuesta dice si la cuenta de Neon se fue de verdad, porque no siempre se
 * va: `delete-user` acepta `password` y `token` según cómo esté configurado el
 * servicio, y aquí no se le pasa ninguno. Si lo rechaza, los datos personales ya
 * no están —que es lo que prometen los términos— pero la cuenta sigue existiendo,
 * y quien lea la respuesta tiene que poder enterarse.
 */
export async function DELETE() {
  const sessionUser = await getAppUser();

  if (!sessionUser) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  /* El negocio que lleva, si lleva alguno, y se borra **antes** que su fila.
     Después ya no habría forma de saber cuál era: `business_owners` cae en
     cascada con el usuario, así que el vínculo desaparecería y la ficha se
     quedaría publicada y sin dueño —imposible de editar para nadie, y con el
     correo y el teléfono del dueño dentro—. `places.created_by` es `SET NULL`,
     o sea que la base por sí sola no la borra: hay que hacerlo aquí.

     Con esto la página de términos puede decir la verdad cuando promete que
     desaparecen «los negocios que lleves». */
  const [owned] = await db
    .select({ placeId: businessOwners.placeId })
    .from(businessOwners)
    .where(eq(businessOwners.userId, sessionUser.id))
    .limit(1);

  if (owned) {
    await db.delete(places).where(eq(places.id, owned.placeId));
  }

  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, sessionUser.id))
    .returning({ id: users.id });

  if (!deleted) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let accountDeleted = true;
  try {
    const result = await auth.deleteUser();
    if (result?.error) accountDeleted = false;
  } catch (error) {
    accountDeleted = false;
    console.error("Se borró la fila del usuario pero no la cuenta de Neon:", error);
  }

  return NextResponse.json({ ok: true, id: deleted.id, accountDeleted });
}

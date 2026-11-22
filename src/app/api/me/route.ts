import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import {
  isGoogleAccount,
  isMarketingOptedIn,
  setMarketingOptIn,
} from "@/lib/contacts";
import { db } from "@/lib/db";
import {
  businessOwners,
  categories,
  places,
  projectRequests,
  users,
} from "@/lib/db/schema";
import { devPlace, ownsDevPlace } from "@/lib/dev-place";
import { asegurarAvisosDeNegocio } from "@/lib/notificaciones-server";
import { TERMS_VERSION } from "@/lib/legal";
import type { PlacePlan } from "@/lib/places-store";

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
  reviewStatus: "pending" | "approved" | "rejected";
  /** El plan con el que se dio de alta, para que el dueño vea el suyo. `null`
      en las fichas que no pasaron por el formulario del perfil. */
  plan: PlacePlan | null;
  category: string;
  description: string | null;
  address: string | null;
  barrio: string | null;
  phone: string | null;
  /* La sección «Contacto» del formulario, para que el dueño que vuelve a
     enviar una solicitud rechazada la vea rellena en vez de vacía. */
  website: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  schedule: string | null;
  lat: number;
  lng: number;
  payments: string[] | null;
}

async function businessOf(userId: string): Promise<AppBusiness | null> {
  const [row] = await db
    .select({
      id: places.id,
      name: places.name,
      isActive: places.isActive,
      reviewStatus: places.reviewStatus,
      plan: places.plan,
      category: categories.slug,
      description: places.description,
      address: places.address,
      barrio: places.neighborhood,
      phone: places.phone,
      website: places.website,
      whatsapp: places.whatsapp,
      instagram: places.instagram,
      facebook: places.facebook,
      schedule: places.schedule,
      lat: places.lat,
      lng: places.lng,
      payments: places.paymentMethods,
    })
    .from(businessOwners)
    .innerJoin(places, eq(businessOwners.placeId, places.id))
    .innerJoin(categories, eq(places.categoryId, categories.id))
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
/** El negocio de prueba, con la forma que espera el menú de usuario. */
function devBusiness(): AppBusiness {
  const d = devPlace();
  return {
    id: d.id,
    name: d.name,
    isActive: d.isActive,
    reviewStatus: d.reviewStatus,
    plan: d.plan ?? null,
    category: d.category,
    description: d.description || null,
    address: d.address || null,
    barrio: d.barrio || null,
    phone: d.phone ?? null,
    website: d.website ?? null,
    whatsapp: d.whatsapp ?? null,
    instagram: d.instagram ?? null,
    facebook: d.facebook ?? null,
    schedule: d.schedule || null,
    lat: d.lat,
    lng: d.lng,
    payments: d.payments ?? null,
  };
}

async function businessFor(
  id: string,
  role: string,
  email: string,
): Promise<AppBusiness | null> {
  /* El negocio de prueba no tiene fila en `business_owners`, así que no lo
     encuentra `businessOf`. Se devuelve el fixture a su **dueño** —la cuenta
     autorizada— para que el menú de usuario enseñe «Mi negocio» igual que con
     uno real. `ownsDevPlace` y no `canViewDevPlace`: esto es «¿es tu negocio?»,
     no «¿puedes verlo?», y en desarrollo lo segundo vale para cualquiera. */
  const dev = ownsDevPlace(email) ? devBusiness() : null;
  if (role !== "owner" && role !== "admin") return dev;
  return (await businessOf(id)) ?? dev;
}

/**
 * Si esta persona ya tiene algún proyecto.
 *
 * El menú decide con esto si enseña «Administrar proyectos»: sin ninguno, el
 * panel solo pinta el estado vacío que manda a «Tengo un negocio» del perfil, y
 * ese camino ya está en el perfil. A diferencia del negocio —que exige rol—,
 * cualquier usuario puede tener proyectos, así que aquí no hay guarda que ahorre
 * la consulta: es un `limit(1)` sobre el índice de `user_id`.
 */
async function userHasProjects(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: projectRequests.id })
    .from(projectRequests)
    .where(eq(projectRequests.userId, userId))
    .limit(1);

  return Boolean(row);
}

/**
 * Lo que la interfaz necesita saber del consentimiento de novedades.
 *
 * `isGoogle` viaja para poder pedir el consentimiento **una sola vez** a quien
 * entró con Google: esa cuenta nunca pasó por la casilla del alta, así que su
 * `marketing_opt_in` es `false` por defecto y no por decisión. A quien se
 * registró con contraseña y dejó la casilla vacía no se le pregunta: ya la vio.
 *
 * La consulta a `neon_auth` solo se hace para quien la necesita —el cliente
 * decide—, pero sale barata y va en paralelo con la de `contacts`.
 */
async function marketingState(user: {
  id: string;
  authUserId: string | null;
}): Promise<{ optedIn: boolean; isGoogle: boolean }> {
  const [optedIn, isGoogle] = await Promise.all([
    isMarketingOptedIn(user.id),
    user.authUserId ? isGoogleAccount(user.authUserId) : Promise.resolve(false),
  ]);
  return { optedIn, isGoogle };
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

/* La sesión no se guarda en ninguna caché: ni la del navegador, ni una
   intermedia. Safari en iOS reutiliza respuestas sin cabeceras explícitas, y
   una `authenticated: false` anterior al login dejaba el header en «Iniciar
   sesión» hasta recargar a mano. */
const SIN_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAppUser();

  if (!user) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { headers: SIN_CACHE },
    );
  }

  /* Las dos consultas a la vez y no encadenadas: el menú llama aquí en **cada**
     página, así que un viaje de red de más se paga en todas. */
  const [business, hasProjects] = await Promise.all([
    businessFor(user.id, user.role, user.email),
    userHasProjects(user.id),
  ]);

  /* Los avisos del negocio se aseguran aquí y no en la ruta que lo aprueba.
     Por esta pasa todo el mundo en cada página, así que también recibe el suyo
     el negocio que quedó vinculado a una cuenta sin pasar por el panel —uno
     creado por administración y enlazado a mano en `business_owners`—. Los dos
     avisos son idempotentes, así que repetir la llamada no duplica nada.
     Best-effort: un aviso que no sale no puede tumbar el menú. */
  if (business?.isActive) {
    try {
      await asegurarAvisosDeNegocio({
        userId: user.id,
        placeId: business.id,
        nombre: business.name,
      });
    } catch (error) {
      console.error("No se pudieron asegurar los avisos del negocio:", error);
    }
  }

  return NextResponse.json(
    {
      marketing: await marketingState(user),
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        termsVersion: user.termsVersion,
        role: user.role,
        locationCity: user.locationCity,
        onboardingCompleted: user.onboardingCompleted,
        preferences: user.preferences,
        /* Solo el «sí o no»: el menú decide con esto si enseña «Enlaces». El
         código no viaja aquí porque la página lo lee del servidor, que es donde
         se arma el enlace. */
        affiliateEnabled: Boolean(user.referralCode),
        /* Solo el «sí o no»: el menú decide con esto si enseña «Administrar
         proyectos». */
        hasProjects,
        business,
      },
    },
    { headers: SIN_CACHE },
  );
}

export async function POST(request: NextRequest) {
  const sessionUser = await getAppUser();

  if (!sessionUser) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401 },
    );
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const nextName =
    typeof payload.name === "string" ? payload.name.trim() : null;
  const nextEmail =
    typeof payload.email === "string" ? payload.email.trim() : null;
  const nextLocation =
    typeof payload.location === "string" ? payload.location.trim() : null;
  const nextLocationName =
    typeof payload.locationName === "string"
      ? payload.locationName.trim()
      : null;
  const nextPhone =
    typeof payload.phone === "string" ? payload.phone.trim() : null;
  const nextOnboarding =
    typeof payload.onboardingCompleted === "boolean"
      ? payload.onboardingCompleted
      : null;
  /* La aceptación de los términos, tal cual la manda el alta. */
  const nextTermsVersion =
    typeof payload.termsVersion === "string"
      ? payload.termsVersion.trim()
      : null;
  /* `undefined` y no `false` cuando no viene: el perfil y el onboarding llaman
     aquí sin este campo, y tratar la ausencia como un «no» daría de baja a
     quien ya había dicho que sí. */
  const nextMarketingOptIn =
    typeof payload.marketingOptIn === "boolean" ? payload.marketingOptIn : null;
  const nextInterests = asStringArray(payload.interests);
  const nextMoods = asStringArray(payload.moods);
  const nextCurrencies = asStringArray(payload.currencies);

  const [row] = await db
    .update(users)
    .set({
      name: nextName ?? sessionUser.name,
      email: nextEmail ?? sessionUser.email,
      /* `?? sessionUser.phone` y no `?? null`: el onboarding guarda las
         preferencias sin mandar el teléfono, y con un `null` seco cada paso por
         ahí lo habría borrado. Una cadena vacía sí lo borra —es lo que se manda
         al vaciar el campo en el perfil—; ausente significa «no lo toques». */
      phone: nextPhone ?? sessionUser.phone,
      /* La ubicación y el onboarding solo se escriben si el cuerpo los trae.
         El consentimiento de marketing y el alta mandan un cuerpo parcial, y el
         `?? null` / `?? false` de antes borraba la provincia y el onboarding de
         quien solo estaba aceptando avisos: sin provincia, deja de recibir los
         avisos de negocios nuevos de su zona. */
      ...(nextLocation === null && nextLocationName === null
        ? {}
        : { locationCity: nextLocation || nextLocationName || null }),
      /* Mismo criterio que la ubicación: las preferencias solo se escriben si
         el cuerpo trae alguna. La ventana del teléfono, los términos y el
         consentimiento de marketing mandan un cuerpo parcial, y antes cada uno
         de esos guardados dejaba intereses, ambientes y monedas vacíos. */
      ...("interests" in payload || "moods" in payload || "currencies" in payload
        ? {
            preferences: {
              interests: nextInterests.length > 0 ? nextInterests : undefined,
              moods: nextMoods.length > 0 ? nextMoods : undefined,
              currencies:
                nextCurrencies.length > 0 ? nextCurrencies : undefined,
            },
          }
        : {}),
      ...(nextOnboarding === null ? {} : { onboardingCompleted: nextOnboarding }),
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
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 404 },
    );
  }

  if (nextMarketingOptIn !== null) {
    await setMarketingOptIn(user.id, user.email, nextMarketingOptIn);
  }

  const [business, hasProjects] = await Promise.all([
    businessFor(user.id, user.role, user.email),
    userHasProjects(user.id),
  ]);

  return NextResponse.json({
    authenticated: true,
    marketing: await marketingState(user),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      termsVersion: user.termsVersion,
      role: user.role,
      locationCity: user.locationCity,
      onboardingCompleted: user.onboardingCompleted,
      preferences: user.preferences,
      /* Solo el «sí o no»: el menú decide con esto si enseña «Enlaces». El
         código no viaja aquí porque la página lo lee del servidor, que es donde
         se arma el enlace. */
      affiliateEnabled: Boolean(user.referralCode),
      /* Solo el «sí o no»: el menú decide con esto si enseña «Administrar
         proyectos». */
      hasProjects,
      business,
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
 * - Si el segundo paso falla, lo que sobrevive es una cuenta de Neon sin perfil;
 *   los datos personales ya no están en la app y la respuesta lo dice
 *   (`accountDeleted: false`) para que se le pueda pedir a soporte que la quite a
 *   mano. Al revés —cuenta primero— un fallo al borrar la fila dejaría los datos
 *   en pie justo después de haber dicho que se borraron, que es el peor final
 *   posible.
 *
 * La segunda mitad pasa por `borrarCuentaDeNeon()`, que borra la fila como ya
 * hace el panel de administración. La respuesta lleva `accountDeleted`
 * **comprobado** contra `neon_auth.user`, y
 * no lo que diga el SDK, porque de eso dependen las dos cosas que se prometen
 * aquí: que la contraseña deje de valer y que el correo quede libre para un alta
 * nueva.
 */
export async function DELETE() {
  const sessionUser = await getAppUser();

  if (!sessionUser) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401 },
    );
  }

  /* El negocio que lleva, si lleva alguno, y se borra **antes** que su fila.
     Después ya no habría forma de saber cuál era: `business_owners` cae en
     cascada con el usuario, así que el vínculo desaparecería y la ficha se
     quedaría publicada y sin dueño —imposible de editar para nadie, y con el
     correo y el teléfono del dueño dentro—. `places.created_by` es `SET NULL`,
     o sea que la base por sí sola no la borra: hay que hacerlo aquí.

     Con esto la página de términos puede decir la verdad cuando promete que
     desaparecen «los negocios que lleves».

     Solo las filas `owner`: un trabajador que borra su cuenta no puede llevarse
     por delante el negocio del jefe. Su vínculo cae en cascada con el usuario,
     y la ficha se queda donde está. */
  const [owned] = await db
    .select({ placeId: businessOwners.placeId })
    .from(businessOwners)
    .where(
      and(
        eq(businessOwners.userId, sessionUser.id),
        eq(businessOwners.role, "owner"),
      ),
    )
    .limit(1);

  if (owned) {
    await db.delete(places).where(eq(places.id, owned.placeId));
  }

  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, sessionUser.id))
    .returning({ id: users.id });

  if (!deleted) {
    return NextResponse.json(
      { error: "Cuenta no encontrada" },
      { status: 404 },
    );
  }

  /* La cuenta de acceso va después de la fila, y comprobada: es la mitad que
     decide si se puede volver a entrar. Ver `borrarCuentaDeNeon`. */
  const accountDeleted = await borrarCuentaDeNeon(sessionUser.authUserId);

  return NextResponse.json({ ok: true, id: deleted.id, accountDeleted });
}

/** Los ids de `neon_auth` son uuid; el de la puerta de desarrollo también tiene
    esa forma a propósito, aunque no exista allí. */
const UUID_RE = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Si la cuenta de acceso sigue en `neon_auth.user`. */
async function cuentaDeNeonExiste(authUserId: string): Promise<boolean> {
  const result = await db.execute<{ ok: number }>(sql`
    SELECT 1 AS ok
    FROM neon_auth.user
    WHERE id = ${authUserId}::uuid
    LIMIT 1
  `);
  return (result.rows ?? []).length > 0;
}

/**
 * Deja sin fila la cuenta de acceso, o dice que no pudo.
 *
 * Es el mismo `DELETE` directo que usa el panel de administración. De
 * `neon_auth.user` cuelgan en cascada `account` —la contraseña o el vínculo con
 * Google—, `session`, `member` e `invitation`, así que con la fila se van las
 * credenciales y las sesiones abiertas, y el correo queda libre para un alta
 * nueva. Es lo que hace que, después de borrar, entrar falle y registrarse otra
 * vez con el mismo correo funcione.
 *
 * Se responde con la comprobación y no con el resultado del `DELETE`: un error
 * a mitad se leería como «no se borró» aunque la fila ya no estuviera, y el
 * aviso que vería la persona diría algo falso.
 */
async function borrarCuentaDeNeon(authUserId: string | null): Promise<boolean> {
  /* `auth_user_id` es opcional: una fila sin él no tiene cuenta de Neon, y no
     hay correo ocupado del que hablar. Un id que no es uuid tampoco puede ser
     una fila de `neon_auth.user`, cuyo id es uuid. */
  if (!authUserId || !UUID_RE.test(authUserId)) return true;

  try {
    await db.execute(sql`
      DELETE FROM neon_auth.user
      WHERE id = ${authUserId}::uuid
    `);
  } catch (error) {
    console.error("No se pudo borrar la cuenta de Neon:", error);
  }

  return !(await cuentaDeNeonExiste(authUserId));
}

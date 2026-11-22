import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/auth/public-origin";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { TERMS_VERSION } from "@/lib/legal";
import { safeNext } from "@/lib/session";

export async function GET(request: NextRequest) {
  /* Better Auth deja la cookie de sesión en la vuelta de Google y esta ruta es
     una API route: bypasea el proxy, pero `getAppUser()` sí puede leer la
     sesión desde aquí. */

  /* El origen no sale de `request.url`: dentro del contenedor ese URL lleva el
     host interno (`0.0.0.0:3000`) cuando el proxy no reenvía `Host`. Ver
     `publicOrigin` en `src/lib/auth/public-origin.ts`. */
  const origin = publicOrigin(request);

  const user = await getAppUser();
  if (!user) {
    return NextResponse.redirect(new URL("/register", origin));
  }

  /* La aceptación solo se guarda si viene del botón de registro, que es el
     único que exige marcar la casilla (`alta=1`). Antes se escribía en cada
     vuelta de Google: quien pulsaba «Iniciar sesión con Google» sin cuenta
     quedaba dado de alta con unos términos que nunca vio, y a quien ya los
     había aceptado se le reescribía la fecha en cada acceso. */
  if (request.nextUrl.searchParams.get("alta") === "1") {
    await db
      .update(users)
      .set({
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  }

  /* El plan elegido en la portada viaja por aquí: sin esto, entrar con Google
     perdía el `next` y dejaba al recién registrado en el onboarding genérico.
     Sin `next`, la marca del onboarding decide: quien ya lo completó va al Home
     —también quien pulsó «Registrarse con Google» con una cuenta que ya existía—
     y quien no lo ha hecho empieza el flujo, que es el camino normal. */
  const landed = safeNext(request.nextUrl.searchParams.get("next"));
  const target = new URL(
    /* `/entrar` lleva al panel a quien lleva un negocio, y al Home al resto. */
    landed ?? (user.onboardingCompleted ? "/entrar" : "/onboarding"),
    origin,
  );
  /* Google no recoge teléfono. Si la cuenta acaba de nacer sin él, el
     onboarding abre la ventana que lo pide antes de empezar. */
  if (!user.phone?.trim()) target.searchParams.set("pedirTelefono", "1");
  target.searchParams.set("showSessionNotice", "1");
  return NextResponse.redirect(target);
}

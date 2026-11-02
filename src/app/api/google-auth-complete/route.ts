import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { TERMS_VERSION } from "@/lib/legal";
import { safeNext } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.redirect(new URL("/register", request.url));
  }

  await db
    .update(users)
    .set({
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  /* El plan elegido en la portada viaja por aquí: sin esto, entrar con Google
     perdía el `next` y dejaba al recién registrado en el onboarding genérico. */
  const target = new URL(
    safeNext(new URL(request.url).searchParams.get("next")) ?? "/onboarding",
    request.url,
  );
  /* Google no recoge teléfono. Si la cuenta acaba de nacer sin él, el
     onboarding abre la ventana que lo pide antes de empezar. */
  if (!user.phone?.trim()) target.searchParams.set("pedirTelefono", "1");
  target.searchParams.set("showSessionNotice", "1");
  return NextResponse.redirect(target);
}

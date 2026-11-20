import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Deja al administrador que lo pide como recién creado, para poder recorrer el
 * onboarding otra vez.
 *
 * **Temporal.** Existe para la ronda de pruebas del flujo de registro y se borra
 * junto con `/admin/prueba-onboarding` cuando acabe.
 *
 * No recibe a quién reiniciar: siempre es la cuenta de la sesión. Así la ruta
 * no sirve para tocar el onboarding de nadie más aunque alguien la descubriera,
 * y no hace falta validar ningún id que venga del cliente.
 *
 * Se limpian también la ciudad y las preferencias, y no solo la marca: el
 * onboarding las mezcla con las de `localStorage` al arrancar, y sin esto las
 * pantallas de intereses y monedas saldrían premarcadas con lo de la prueba
 * anterior en vez de como las ve alguien nuevo.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  /* La cabecera `x-admin-key` pasa `isAdminRequest` pero no identifica a nadie:
     sin sesión no hay cuenta que reiniciar, y no se adivina por el cuerpo. */
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const [updated] = await db
    .update(users)
    .set({
      onboardingCompleted: false,
      locationCity: null,
      preferences: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning({ id: users.id });

  if (!updated) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}

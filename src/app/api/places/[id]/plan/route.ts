import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { canManagePlace } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { CATALOG_TAG } from "@/lib/db/queries";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { saveDevPlacePlan } from "@/lib/dev-place-server";
import { PLAN_ORDER, type Plan } from "@/lib/plans";

/**
 * El plan del negocio de prueba, elegido a mano.
 *
 * Un negocio normal cambia de plan por la pasarela de pago o por administración
 * —`suscripciones`—. El fixture no tiene fila en esa tabla ni la puede tener
 * —clave foránea a `places`—, así que su plan vive en `place_overrides.plan` y
 * esta es la única puerta que lo escribe.
 *
 * La ruta está **cerrada al fixture** (`id === DEV_PLACE_ID`): sin ese candado
 * cualquier cuenta autorizada en el mismo despliegue podría cambiarse el plan
 * por esta vía. `canManagePlace` sigue haciendo falta además, porque en
 * producción el fixture lo ven muy pocas cuentas y aquí se pide su nombre.
 *
 * El `plan` describe al fixture, no a quien lo mira, así que se guarda global
 * (fila del usuario que lo cambia, pero `readDevPlacePlan` lee el más reciente).
 */
const PLAN_IDS = new Set<string>(PLAN_ORDER);

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (id !== DEV_PLACE_ID) {
    return NextResponse.json(
      { error: "Solo el negocio de prueba cambia de plan por aquí." },
      { status: 404 },
    );
  }

  if (!(await canManagePlace(req, id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { plan?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const plan =
    typeof body.plan === "string" && PLAN_IDS.has(body.plan)
      ? (body.plan as Plan)
      : null;

  if (!plan) {
    return NextResponse.json(
      { error: "Plan inválido. Usa gratis, basico o pro." },
      { status: 400 },
    );
  }

  await saveDevPlacePlan(user.id, plan);

  /* El plan decide qué features entran, y varias las lee el catálogo cacheado.
     Sin esta invalidación, subir de plan no enseña el candado nuevo hasta que
     venza el TTL de la caché (300s). */
  revalidateTag(CATALOG_TAG, "max");

  return NextResponse.json({ plan });
}

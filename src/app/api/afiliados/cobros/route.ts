import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { afiliadoCobros } from "@/lib/db/schema";
import { aCup, METODOS_COBRO, REGLAS_AFILIADOS, resumenAfiliado, tasaUsdCup, type MetodoCobro } from "@/lib/afiliados";
import { generateId } from "@/lib/utils";

/**
 * El afiliado pide cobrar **todo lo disponible**. El importe lo calcula el
 * servidor con `resumenAfiliado`; del navegador solo llegan el método y el
 * destino. El pago lo hace luego un administrador a mano y lo marca en
 * `/admin/afiliados`.
 */
export async function POST(request: NextRequest) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "Entra a tu cuenta." }, { status: 401 });
  if (!user.referralCode) return NextResponse.json({ error: "No estás en el programa de afiliados." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { metodo?: unknown; destino?: unknown } | null;
  const metodo = typeof body?.metodo === "string" && body.metodo in METODOS_COBRO ? (body.metodo as MetodoCobro) : null;
  const destino = typeof body?.destino === "string" ? body.destino.replace(/\s+/g, "").slice(0, 32) : "";
  if (!metodo) return NextResponse.json({ error: "Elige cómo quieres cobrar." }, { status: 400 });
  if (!/^[0-9+]{8,20}$/.test(destino)) {
    return NextResponse.json({ error: "Escribe el número de teléfono o de tarjeta, solo con dígitos." }, { status: 400 });
  }

  const resumen = await resumenAfiliado(user.id);
  if (resumen.dinero.pedido > 0) {
    return NextResponse.json({ error: "Ya tienes un cobro pedido. Espera a que te lo paguemos." }, { status: 409 });
  }
  const tasa = tasaUsdCup();
  const usd = resumen.dinero.disponible;
  const cup = aCup(usd, tasa);
  if (cup < REGLAS_AFILIADOS.cobroMinimoCup) {
    return NextResponse.json(
      { error: `Necesitas al menos ${REGLAS_AFILIADOS.cobroMinimoCup} CUP disponibles para pedir el cobro.` },
      { status: 400 },
    );
  }

  await db.insert(afiliadoCobros).values({
    id: generateId(),
    afiliadoId: user.id,
    montoCupCentavos: cup * 100,
    montoUsdCentavos: usd,
    tasaUsdCup: tasa,
    metodo,
    destino,
  });
  return NextResponse.json({ ok: true, cup });
}

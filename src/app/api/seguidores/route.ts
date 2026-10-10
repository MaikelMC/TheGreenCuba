import { NextRequest, NextResponse } from "next/server";
import { canManagePlace } from "@/lib/admin-server";
import { planEfectivoDe } from "@/lib/plans-server";
import { AVISOS_POR_SEMANA, avisosRestantes } from "@/lib/seguidores";
import {
  avisosDeLaSemana,
  contarSeguidores,
  enlaceSeguidoresDe,
} from "@/lib/seguidores-server";

/**
 * El estado de los seguidores, para la tarjeta del panel.
 *
 * **Solo el dueño.** `canManagePlace` deja pasar al negocio dueño y al
 * administrador, y a nadie más: los avisos de una semana y el enlace al bot no
 * son datos públicos —el enlace sí, pero se sirve desde aquí para no tener que
 * pasear el nombre del bot por toda la ficha—.
 *
 * Devuelve tres cosas y ninguna es un dato personal: **el enlace** al bot (para
 * que el dueño pueda repartirlo por su cuenta, que es la mitad del valor de una
 * función de seguidores), **cuántos** tiene y **cuántos avisos le quedan esta
 * semana**. Los identificadores de los chats no salen de la base: al negocio le
 * sirve el número, no quiénes son sus seguidores.
 *
 * El gasto de la semana se cuenta con la misma función que el tope de
 * `avisarSeguidores`, así que lo que el panel enseña y lo que el servidor corta
 * no pueden decir cosas distintas.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const negocioId = req.nextUrl.searchParams.get("negocioId")?.trim() ?? "";
  if (!negocioId) {
    return NextResponse.json(
      { error: "Falta el negocio" },
      { status: 400 },
    );
  }

  if (!(await canManagePlace(req, negocioId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const plan = await planEfectivoDe(negocioId);
  const [total, usados] = await Promise.all([
    contarSeguidores(negocioId),
    avisosDeLaSemana(negocioId),
  ]);

  return NextResponse.json({
    enlace: enlaceSeguidoresDe(negocioId, plan),
    seguidores: total,
    avisos: {
      usados,
      tope: AVISOS_POR_SEMANA,
      restantes: avisosRestantes(usados),
    },
  });
}

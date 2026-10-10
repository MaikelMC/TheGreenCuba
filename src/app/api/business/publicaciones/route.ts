import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { publicaciones } from "@/lib/db/schema";
import { toPublicacion } from "@/lib/db/mappers";
import { incluye, limiteDe } from "@/lib/plans";
import { planEfectivoDe } from "@/lib/plans-server";
import {
  encolarPublicacion,
  enlacePerfilDe,
} from "@/lib/publicaciones-server";
import {
  esEstadoPublicacion,
  semanaDe,
  validarContenidoPublicacion,
  type EstadoPublicacion,
} from "@/lib/publicaciones";

/**
 * Las publicaciones de Facebook, desde el panel del negocio.
 *
 * Es la puerta del dueño, y es distinta de la de administración en **a quién deja
 * pasar**: aquí no hay `negocioId` de confianza —el negocio lo pone el cliente y
 * hay que comprobar que sea suyo—, así que todo pasa por `canManagePlace`, que
 * es lo mismo que ya usan las fotos del negocio. Sin eso, cualquier cuenta con
 * sesión podría encolar publicaciones en la ficha de otro.
 *
 * Lo que **no** se puede desde aquí: marcar publicada. El posteo lo hace la
 * administración a mano, y el enlace del post es suyo. El dueño redacta, adjunta
 * foto y envía a la cola; a partir de ahí miran los dos la misma fila.
 */

/** La cola de la semana en curso de un negocio, con lo que le queda de tope. */
export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId")?.trim() ?? "";
  if (!placeId) {
    return NextResponse.json({ error: "Falta placeId" }, { status: 400 });
  }
  if (!(await canManagePlace(req, placeId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const semana = semanaDe(new Date());
  const plan = await planEfectivoDe(placeId);

  const rows = await db
    .select()
    .from(publicaciones)
    .where(
      and(
        eq(publicaciones.negocioId, placeId),
        eq(publicaciones.semana, semana),
      ),
    )
    .orderBy(asc(publicaciones.createdAt));

  return NextResponse.json({
    semana,
    plan,
    puede: incluye(plan, "publicaciones_fb"),
    tope: limiteDe(plan, "publicaciones_semana"),
    usadas: rows.length,
    enlacePerfil: enlacePerfilDe(placeId),
    publicaciones: rows.map(toPublicacion),
  });
}

/**
 * Encola una publicación del negocio.
 *
 * Nace `lista`, no `borrador`: lo que el dueño manda ya está para postear, y la
 * distinción entre los dos estados no le sirve de nada. El plan y el tope los
 * aplica `encolarPublicacion`, igual que cuando encola la administración.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido" },
      { status: 400 },
    );
  }

  const placeId =
    typeof body.placeId === "string" ? body.placeId.trim() : "";
  if (!placeId) {
    return NextResponse.json({ error: "Falta placeId" }, { status: 400 });
  }
  if (!(await canManagePlace(req, placeId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const contenido = validarContenidoPublicacion(body);
  if (typeof contenido === "string") {
    return NextResponse.json({ error: contenido }, { status: 400 });
  }

  /* `borrador` se acepta por si el dueño guarda a medias, pero `publicada` no:
     el enlace del post lo pone la administración al postearlo. */
  const estado: EstadoPublicacion =
    esEstadoPublicacion(body.estado) && body.estado !== "publicada"
      ? body.estado
      : "lista";

  const resultado = await encolarPublicacion(placeId, contenido, estado);
  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.status },
    );
  }

  return NextResponse.json(resultado.publicacion, { status: 201 });
}

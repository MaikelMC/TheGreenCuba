import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { places, publicaciones, suscripciones } from "@/lib/db/schema";
import { toPublicacion } from "@/lib/db/mappers";
import { incluye, LIMITES, planEfectivo, type Plan } from "@/lib/plans";
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
 * La cola de publicaciones de Facebook, para administración.
 *
 * El posteo **no se automatiza** —Facebook no lo permite en grupos sin arriesgar
 * el bloqueo—, así que esta API solo prepara la cola: redacta, guarda y ordena;
 * postear y marcar el enlace lo hace una persona desde la pantalla.
 *
 * Desde que el negocio encola las suyas desde su panel (`/api/business/…`), el
 * alta **no vive aquí**: la comparten las dos puertas en `encolarPublicacion`.
 * Lo que sí es solo de administración es ver la cola entera y marcar publicada.
 *
 * `isAdminRequest` acepta la sesión de administrador o la cabecera
 * `x-admin-key`, igual que el resto de rutas de administración.
 */

/**
 * La cola de la semana en curso, negocio por negocio.
 *
 * Solo salen los negocios que **pueden** publicar —Básico en adelante, o Pro de
 * prueba— y los que ya tienen algo en cola aunque hayan bajado de plan: un
 * negocio en Gratis con publicaciones de esta semana tiene que seguir viéndose
 * para poder terminarlas, y no tiene sentido pintar treinta negocios que no
 * pueden usar la función. El plan efectivo decide, no `places.plan`, que es lo
 * que eligió el dueño al darse de alta y no dice nada de permisos.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const semana = semanaDe(new Date());

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      plan: suscripciones.plan,
      estado: suscripciones.estado,
      trialHasta: suscripciones.trialHasta,
      venceEn: suscripciones.venceEn,
    })
    .from(places)
    .leftJoin(suscripciones, eq(suscripciones.negocioId, places.id))
    .orderBy(asc(places.name));

  const delasSemana = await db
    .select()
    .from(publicaciones)
    .where(eq(publicaciones.semana, semana))
    .orderBy(asc(publicaciones.createdAt));

  const porNegocio = new Map<string, ReturnType<typeof toPublicacion>[]>();
  for (const row of delasSemana) {
    const item = toPublicacion(row);
    const list = porNegocio.get(row.negocioId);
    if (list) list.push(item);
    else porNegocio.set(row.negocioId, [item]);
  }

  const negocios = rows
    .map((row) => {
      const plan: Plan = planEfectivo(
        row.plan && row.estado
          ? {
              plan: row.plan,
              estado: row.estado,
              trialHasta: row.trialHasta,
              venceEn: row.venceEn,
            }
          : null,
      );
      const items = porNegocio.get(row.id) ?? [];
      return {
        id: row.id,
        nombre: row.name,
        plan,
        puede: incluye(plan, "publicaciones_fb"),
        tope: LIMITES.publicaciones_semana[plan],
        usadas: items.length,
        enlacePerfil: enlacePerfilDe(row.id),
        publicaciones: items,
      };
    })
    .filter((negocio) => negocio.puede || negocio.publicaciones.length > 0);

  /* Lo que hay que postear, arriba. La lista se armaba por nombre, así que un
     negocio con tres publicaciones esperando podía quedar debajo de treinta sin
     nada. El orden de dentro no se toca —`createdAt`, que es el de llegada—; el
     `sort` es estable, así que entre los que sí tienen cola se sigue leyendo por
     nombre. */
  negocios.sort(
    (a, b) => Number(b.publicaciones.length > 0) - Number(a.publicaciones.length > 0),
  );

  return NextResponse.json({ semana, negocios });
}

/**
 * Encola una publicación nueva, en nombre de un negocio.
 *
 * Aquí solo queda la puerta —quién puede llamar— y la lectura del cuerpo: el
 * plan, el tope y el reparto de plaza son los mismos que los del panel del
 * negocio y viven juntos en `encolarPublicacion`.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido" },
      { status: 400 },
    );
  }

  const negocioId =
    typeof body.negocioId === "string" ? body.negocioId.trim() : "";
  if (!negocioId) {
    return NextResponse.json({ error: "Falta negocioId" }, { status: 400 });
  }

  const contenido = validarContenidoPublicacion(body);
  if (typeof contenido === "string") {
    return NextResponse.json({ error: contenido }, { status: 400 });
  }

  const estado: EstadoPublicacion = esEstadoPublicacion(body.estado)
    ? body.estado
    : "borrador";
  /* Nacer publicada dejaría una fila sin enlace, que es justo lo que el `check`
     de la tabla impide. Publicar es un paso aparte, con el enlace delante. */
  if (estado === "publicada") {
    return NextResponse.json(
      { error: "Para publicar hace falta el enlace del post; usa la edición." },
      { status: 400 },
    );
  }

  const resultado = await encolarPublicacion(negocioId, contenido, estado);
  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.status },
    );
  }

  return NextResponse.json(resultado.publicacion, { status: 201 });
}

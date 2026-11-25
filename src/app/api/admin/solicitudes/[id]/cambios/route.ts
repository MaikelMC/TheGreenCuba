import { and, eq } from "drizzle-orm";
import { after, NextRequest, NextResponse } from "next/server";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { cargarRevisionesSolicitudes } from "@/lib/admin-solicitudes";
import { db } from "@/lib/db";
import { businessOwners, notifications, places } from "@/lib/db/schema";
import { enviarPushAUsuarios } from "@/lib/push-server";
import { generateId } from "@/lib/utils";

/**
 * «Pedir cambios»: manda al solicitante el mensaje generado con lo que falta.
 *
 * Se usa el canal que ya existe en la app: una notificación en la bandeja y un
 * push a los dispositivos del dueño. No hay plantilla de correo para este caso,
 * y el aviso no puede quedarse en un email que quizá nadie abra: la campana de
 * la app es la vía directa. La solicitud sigue pendiente para que el dueño
 * corrija y vuelva a enviarla.
 */

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const [solicitud] = await db
    .select({
      id: places.id,
      name: places.name,
      reviewStatus: places.reviewStatus,
    })
    .from(places)
    .where(eq(places.id, id))
    .limit(1);

  if (!solicitud) {
    return NextResponse.json(
      { error: "Solicitud no encontrada." },
      { status: 404 },
    );
  }
  if (solicitud.reviewStatus !== "pending") {
    return NextResponse.json(
      { error: "La solicitud ya no está pendiente." },
      { status: 409 },
    );
  }

  const [dueno] = await db
    .select({ userId: businessOwners.userId })
    .from(businessOwners)
    .where(
      and(eq(businessOwners.placeId, id), eq(businessOwners.role, "owner")),
    )
    .limit(1);

  if (!dueno) {
    return NextResponse.json(
      { error: "La solicitud no tiene un dueño vinculado." },
      { status: 409 },
    );
  }

  const revision = (await cargarRevisionesSolicitudes()).find(
    (fila) => fila.id === id,
  );
  if (!revision) {
    return NextResponse.json(
      { error: "No se pudo calcular la revisión de la solicitud." },
      { status: 409 },
    );
  }

  const faltan = revision.revision.faltan;
  if (faltan.length === 0) {
    return NextResponse.json(
      {
        error:
          "La revisión automática no encontró datos que falten. Revisa la ficha antes de pedir cambios.",
      },
      { status: 400 },
    );
  }

  const title = "Faltan datos para publicar tu negocio";
  const message = [
    `Para publicar «${solicitud.name}» en La Verde faltan estos datos:`,
    ...faltan.map((falta) => `• ${falta}`),
    "Corrige la ficha y vuelve a enviarla desde Perfil → Mi negocio.",
  ].join("\n");

  await db.insert(notifications).values({
    id: generateId(),
    userId: dueno.userId,
    type: "business_changes_requested",
    title,
    message,
    placeId: id,
    senderName: "Support La Verde",
  });

  after(async () => {
    await enviarPushAUsuarios([dueno.userId], {
      title,
      body: message,
      url: "/profile?seccion=negocio",
      tag: `solicitud-${id}`,
    });
  });

  await registrarActividad({
    accion: ACCION.pedirCambiosSolicitud,
    objetoTipo: "negocio",
    objetoId: id,
    resumen: `Pidió cambios en la solicitud de «${solicitud.name}»`,
    datos: { faltan },
  });

  return NextResponse.json({ ok: true, faltan });
}

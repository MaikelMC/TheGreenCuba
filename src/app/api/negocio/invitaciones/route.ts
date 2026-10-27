import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { esDuenoDePlace } from "@/lib/admin-server";
import { siteConfig } from "@/config/site";
import { db } from "@/lib/db";
import { businessInvitations } from "@/lib/db/schema";
import { normalizarPermisos } from "@/lib/permisos-negocio";
import { generateId } from "@/lib/utils";

/**
 * Enlaces de invitación al equipo.
 *
 * Un trabajador se añade por correo solo si ya tiene cuenta, porque
 * `business_owners.user_id` es una clave foránea. Este enlace es el otro camino:
 * quien todavía no se ha registrado lo abre, crea su cuenta y cae ya dentro del
 * panel con los permisos que el dueño marcó.
 *
 * Solo el dueño (o un administrador) genera enlaces: `esDuenoDePlace` es la
 * misma guarda que reparte accesos en `/api/negocio/trabajadores`.
 */

/** Una semana: el enlace se manda hoy y la persona se registra cuando puede. */
const DIAS_DE_VALIDEZ = 7;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const negocioId =
    typeof body.negocioId === "string" ? body.negocioId.trim() : "";
  const permisos = normalizarPermisos(body.permisos);

  if (!(await esDuenoDePlace(req, negocioId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  /* 24 caracteres de nanoid: es un secreto que viaja en la URL, así que no vale
     el `generateId()` de 12 que usan las claves primarias. */
  const token = nanoid(24);
  const expiresAt = new Date(Date.now() + DIAS_DE_VALIDEZ * 24 * 60 * 60 * 1000);

  await db.insert(businessInvitations).values({
    id: generateId(),
    token,
    placeId: negocioId,
    permissions: permisos,
    expiresAt,
  });

  return NextResponse.json({
    url: `${siteConfig.url}/invitacion/${token}`,
    expiresAt: expiresAt.toISOString(),
    permisos,
  });
}

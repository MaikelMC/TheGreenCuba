import { NextRequest, NextResponse, after } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import {
  adminBroadcasts,
  businessOwners,
  notifications,
  places,
  suscripciones,
  users,
} from "@/lib/db/schema";
import { enviarPushAUsuarios } from "@/lib/push-server";
import { rateLimit } from "@/lib/rate-limit";
import { generateId } from "@/lib/utils";
import { CATALOGO, enTrial, packEfectivo } from "@/lib/plans";

export const BROADCAST_SENDER = "Support La Verde";

const MAX_TITLE = 120;
const MAX_MESSAGE = 2000;
const TAMANO_LOTE = 1000;
const LIMITE_ENVIOS = 3;
const VENTANA_ENVIOS_MS = 60_000;

const DESTINATARIOS_VIVOS = sql`${users.authUserId} IN (SELECT id::text FROM neon_auth.user)`;

interface Segmento {
  id: string;
  etiqueta: string;
  count: number;
}

interface FilaNegocio {
  userId: string;
  negocio: string;
  plan: string | null;
  estado: string | null;
  trialHasta: Date | null;
  venceEn: Date | null;
}

function aplicarVariables(
  texto: string,
  datos: { nombre: string; negocio: string; ciudad: string },
): string {
  return texto.replace(/\{\{\s*(nombre|negocio|ciudad)\s*\}\}/gi, (_, clave: string) => {
    const valor =
      clave.toLowerCase() === "nombre"
        ? datos.nombre
        : clave.toLowerCase() === "negocio"
          ? datos.negocio
          : datos.ciudad;
    return valor || "";
  });
}

/**
 * Calcula los destinatarios vivos que no se dieron de baja y sus segmentos.
 *
 * Se hace en memoria a propósito: el panel ya trabaja con este mismo conjunto
 * para el recuento y así la unión de varios segmentos no suma personas dos
 * veces. Las bajas (`broadcast_opt_out`) se aplican una sola vez, antes de
 * cualquier segmento.
 */
async function cargarDestinatarios() {
  const [personas, filasNegocio] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        ciudad: users.locationCity,
        codigoAfiliado: users.referralCode,
      })
      .from(users)
      .where(and(DESTINATARIOS_VIVOS, eq(users.broadcastOptOut, false))),
    db
      .select({
        userId: businessOwners.userId,
        negocio: places.name,
        plan: suscripciones.plan,
        estado: suscripciones.estado,
        trialHasta: suscripciones.trialHasta,
        venceEn: suscripciones.venceEn,
      })
      .from(businessOwners)
      .innerJoin(places, eq(places.id, businessOwners.placeId))
      .leftJoin(suscripciones, eq(suscripciones.negocioId, businessOwners.placeId))
      .where(eq(businessOwners.role, "owner"))
      .orderBy(places.name),
  ]);

  const negocioPorUsuario = new Map<string, FilaNegocio>();
  for (const fila of filasNegocio) {
    if (!negocioPorUsuario.has(fila.userId)) negocioPorUsuario.set(fila.userId, fila);
  }

  const ahora = new Date();
  const porId = new Map(personas.map((persona) => [persona.id, persona]));
  const duenos = new Set(
    filasNegocio.map((fila) => fila.userId).filter((id) => porId.has(id)),
  );
  const afiliados = new Set(
    personas.filter((persona) => persona.codigoAfiliado).map((persona) => persona.id),
  );
  const prueba = new Set<string>();
  const porPlan = new Map<string, Set<string>>();
  for (const [userId, fila] of negocioPorUsuario) {
    if (!porId.has(userId) || !fila.plan) continue;
    const suscripcion = {
      plan: fila.plan as "gratis" | "esencial" | "publicidad_max" | "pro",
      estado: fila.estado === "cancelada" ? ("cancelada" as const) : ("activa" as const),
      trialHasta: fila.trialHasta,
      venceEn: fila.venceEn,
      modulos: [],
    };
    if (enTrial(suscripcion, ahora)) prueba.add(userId);
    const plan = enTrial(suscripcion, ahora)
      ? "pro"
      : packEfectivo(suscripcion, ahora);
    const set = porPlan.get(plan) ?? new Set<string>();
    set.add(userId);
    porPlan.set(plan, set);
  }

  const provincias = new Map<string, Set<string>>();
  for (const persona of personas) {
    if (!persona.ciudad) continue;
    const set = provincias.get(persona.ciudad) ?? new Set<string>();
    set.add(persona.id);
    provincias.set(persona.ciudad, set);
  }

  const todos = new Set(personas.map((persona) => persona.id));
  const segmentos: Segmento[] = [
    { id: "todos", etiqueta: "Todos", count: todos.size },
    { id: "duenos", etiqueta: "Dueños de negocio", count: duenos.size },
    { id: "afiliados", etiqueta: "Afiliados activos", count: afiliados.size },
    { id: "prueba", etiqueta: "En prueba", count: prueba.size },
    ...(["gratis", "esencial", "publicidad_max", "pro"] as const).map((plan) => ({
      id: `plan:${plan}`,
      etiqueta: `Plan ${
        plan === "gratis" ? CATALOGO.gratisNombre : CATALOGO.packs[plan].nombre
      }`,
      count: porPlan.get(plan)?.size ?? 0,
    })),
    ...[...provincias.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .map(([ciudad, ids]) => ({
        id: `provincia:${ciudad}`,
        etiqueta: ciudad,
        count: ids.size,
      })),
  ];

  const conjuntos = new Map<string, Set<string>>([
    ["todos", todos],
    ["duenos", duenos],
    ["afiliados", afiliados],
    ["prueba", prueba],
    ...porPlan,
    ...provincias,
  ]);
  for (const [plan, ids] of porPlan) conjuntos.set(`plan:${plan}`, ids);
  for (const [ciudad, ids] of provincias) conjuntos.set(`provincia:${ciudad}`, ids);

  function resolver(segmentIds: string[]): Set<string> {
    const resultado = new Set<string>();
    for (const id of segmentIds) {
      for (const userId of conjuntos.get(id) ?? []) resultado.add(userId);
    }
    return resultado;
  }

  return { personas, porId, negocioPorUsuario, segmentos, resolver };
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [rows, datos] = await Promise.all([
    db
      .select()
      .from(adminBroadcasts)
      .orderBy(desc(adminBroadcasts.createdAt))
      .limit(50),
    cargarDestinatarios(),
  ]);

  const pedidos = request.nextUrl.searchParams.get("segments");
  const seleccionados = pedidos ? pedidos.split(",").filter(Boolean) : [];
  const recipients =
    seleccionados.length > 0
      ? datos.resolver(seleccionados).size
      : datos.personas.length;

  return NextResponse.json({
    broadcasts: rows,
    recipients,
    segments: datos.segmentos,
  });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const limitado = rateLimit(request, LIMITE_ENVIOS, VENTANA_ENVIOS_MS);
  if (!limitado.ok) {
    return NextResponse.json(
      { error: "Demasiados envíos seguidos. Espera un minuto." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    message?: unknown;
    recipientIds?: unknown;
    segmentIds?: unknown;
    test?: unknown;
  } | null;

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!title || title.length > MAX_TITLE) {
    return NextResponse.json(
      { error: `El título es obligatorio (máximo ${MAX_TITLE} caracteres).` },
      { status: 400 },
    );
  }
  if (!message || message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `El mensaje es obligatorio (máximo ${MAX_MESSAGE} caracteres).` },
      { status: 400 },
    );
  }

  const sender = await getAppUser();
  if (!sender) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const datos = await cargarDestinatarios();

  if (body?.test === true) {
    const negocio = datos.negocioPorUsuario.get(sender.id);
    const contenido = aplicarVariables(message, {
      nombre: sender.name,
      negocio: negocio?.negocio ?? "tu negocio",
      ciudad: sender.locationCity ?? "tu ciudad",
    });
    const asunto = aplicarVariables(title, {
      nombre: sender.name,
      negocio: negocio?.negocio ?? "tu negocio",
      ciudad: sender.locationCity ?? "tu ciudad",
    });

    await db.insert(notifications).values({
      id: generateId(),
      userId: sender.id,
      type: "broadcast",
      title: asunto,
      message: contenido,
      senderName: BROADCAST_SENDER,
    });

    after(() =>
      enviarPushAUsuarios([sender.id], {
        title: asunto,
        body: contenido,
        url: "/notifications",
        tag: `broadcast-test-${Date.now()}`,
      }),
    );

    await registrarActividad({
      accion: ACCION.enviarAviso,
      objetoTipo: "sistema",
      objetoId: sender.id,
      resumen: `Se envió una prueba del aviso «${title}»`,
      datos: { prueba: true },
    });

    return NextResponse.json({ test: true, recipients: 1 }, { status: 201 });
  }

  let targetIds: Set<string> | null = null;
  let destino: "todos" | "seleccionados" | "segmentos" = "todos";
  let segmentosElegidos: string[] = [];

  if (body?.segmentIds !== undefined) {
    if (!Array.isArray(body.segmentIds)) {
      return NextResponse.json(
        { error: "La lista de segmentos no es válida." },
        { status: 400 },
      );
    }
    segmentosElegidos = body.segmentIds.filter(
      (value): value is string => typeof value === "string",
    );
    targetIds = datos.resolver(segmentosElegidos);
    destino = "segmentos";
  } else if (body?.recipientIds !== undefined) {
    if (!Array.isArray(body.recipientIds)) {
      return NextResponse.json(
        { error: "La lista de destinatarios no es válida." },
        { status: 400 },
      );
    }
    const crudos = body.recipientIds.filter(
      (value): value is string => typeof value === "string",
    );
    targetIds = new Set(crudos.filter((id) => datos.porId.has(id)));
    destino = "seleccionados";
  }

  const destinatarios =
    targetIds === null
      ? datos.personas
      : datos.personas.filter((persona) => targetIds?.has(persona.id));

  if (destinatarios.length === 0) {
    return NextResponse.json(
      { error: "Ninguno de los destinatarios elegidos puede recibir avisos." },
      { status: 409 },
    );
  }

  const broadcastId = generateId();

  await db.transaction(async (tx) => {
    for (let i = 0; i < destinatarios.length; i += TAMANO_LOTE) {
      await tx.insert(notifications).values(
        destinatarios.slice(i, i + TAMANO_LOTE).map((persona) => {
          const negocio = datos.negocioPorUsuario.get(persona.id);
          const valores = {
            nombre: persona.name?.trim() || persona.email.split("@")[0] || "hola",
            negocio: negocio?.negocio ?? "tu negocio",
            ciudad: persona.ciudad ?? "tu ciudad",
          };
          return {
            id: generateId(),
            userId: persona.id,
            type: "broadcast",
            title: aplicarVariables(title, valores),
            message: aplicarVariables(message, valores),
            senderName: BROADCAST_SENDER,
          };
        }),
      );
    }

    await tx.insert(adminBroadcasts).values({
      id: broadcastId,
      senderId: sender.id,
      senderName: sender.name,
      title,
      message,
      recipientCount: destinatarios.length,
      meta: {
        destino,
        ...(destino === "segmentos" ? { segmentos: segmentosElegidos } : {}),
      },
    });
  });

  after(() =>
    enviarPushAUsuarios(
      destinatarios.map((destinatario) => destinatario.id),
      {
        title: aplicarVariables(title, {
          nombre: "La Verde",
          negocio: "tu negocio",
          ciudad: "tu ciudad",
        }),
        body: aplicarVariables(message, {
          nombre: "La Verde",
          negocio: "tu negocio",
          ciudad: "tu ciudad",
        }),
        url: "/notifications",
        tag: `broadcast-${broadcastId}`,
      },
    ),
  );

  await registrarActividad({
    accion: ACCION.enviarAviso,
    objetoTipo: "sistema",
    objetoId: broadcastId,
    resumen: `Envió el aviso «${title}» a ${destinatarios.length} ${
      destinatarios.length === 1 ? "persona" : "personas"
    }`,
    datos: {
      destinatarios: destinatarios.length,
      destino,
      segmentos: segmentosElegidos,
    },
  });

  return NextResponse.json(
    { id: broadcastId, recipients: destinatarios.length },
    { status: 201 },
  );
}

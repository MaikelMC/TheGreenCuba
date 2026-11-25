import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import {
  businessOwners,
  diagnosticos,
  pagos,
  places,
  publicaciones,
  supportTickets,
  suscripciones,
  users,
} from "@/lib/db/schema";
import { nombreDe, type Plan } from "@/lib/plans";
import { revisarSolicitud } from "@/lib/revision-solicitud";
import { tasaMercadoActual } from "@/lib/tasa-cambio";
import { normalizarTelefono } from "@/lib/telefono";

/**
 * La bandeja de Pendientes y las cifras de la portada, calculadas en el
 * servidor.
 *
 * Los recuentos salen de **una sola consulta** con subconsultas escalares: son
 * índices y agregados baratos, y así la portada no encadena veinte viajes a la
 * base. Las listas (como mucho seis por tipo) sí van aparte, en paralelo, y se
 * cortan en el servidor: el cliente nunca recibe una tabla para contarla.
 *
 * Orden: primero lo que lleva más tiempo esperando a una persona —soporte,
 * solicitudes, pagos—, después lo que se puede resolver con un mensaje y al
 * final lo que es una revisión. Dentro de cada tipo, lo más viejo arriba.
 */

export type TipoPendiente =
  | "soporte"
  | "solicitud"
  | "pago"
  | "cobro"
  | "prueba"
  | "publicacion"
  | "ficha"
  | "diagnostico";

export type AccionPendiente =
  | { tipo: "aprobar_solicitud"; negocioId: string }
  | { tipo: "confirmar_pago"; pagoId: string }
  | { tipo: "abrir"; href: string; etiqueta: string }
  | { tipo: "whatsapp"; href: string; etiqueta: string };

export interface PendienteAdmin {
  clave: string;
  tipo: TipoPendiente;
  etiquetaTipo: string;
  titulo: string;
  detalle: string;
  prioridad: number;
  /** ISO de lo que ordena dentro de su tipo; también se usa para mostrar. */
  fecha: string | null;
  accion: AccionPendiente;
  accionSecundaria: { href: string; etiqueta: string } | null;
}

export interface CifrasPortada {
  /** Centavos de dólar cobrados en el mes en curso. */
  ingresoCentavos: number;
  ingresoUsd: number;
  /** `null` cuando no hay tasa: no se inventa una conversión. */
  ingresoCup: number | null;
  tasaUsdCup: number | null;
  negociosPagando: number;
  pruebasPorVencer: number;
  busquedasSinResultado: number;
}

export interface BandejaAdmin {
  /** Suma de todos los pendientes, no solo de los que se listan. */
  total: number;
  pendientes: PendienteAdmin[];
  cifras: CifrasPortada;
  erroresMapa: number;
}

type FilaResumen = {
  conversaciones: number;
  solicitudes_negocios: number;
  solicitudes_proyectos: number;
  pagos: number;
  cobros: number;
  pruebas: number;
  publicaciones: number;
  fichas: number;
  diagnostico: number;
  ingreso_centavos: number;
  negocios_pagando: number;
  sin_resultado: number;
};

const fechaCorta = new Intl.DateTimeFormat("es-CU", {
  day: "numeric",
  month: "short",
  timeZone: "America/Havana",
});

const ETIQUETA: Record<TipoPendiente, string> = {
  soporte: "Soporte",
  solicitud: "Solicitud",
  pago: "Pago",
  cobro: "Cobro",
  prueba: "Prueba",
  publicacion: "Publicación",
  ficha: "Ficha",
  diagnostico: "Diagnóstico",
};

const PRIORIDAD: Record<TipoPendiente, number> = {
  soporte: 10,
  solicitud: 20,
  pago: 30,
  cobro: 40,
  prueba: 50,
  publicacion: 60,
  ficha: 70,
  diagnostico: 80,
};

/** Enlace de WhatsApp a partir de un teléfono cubano ya normalizado. */
function enlaceWhatsapp(normalizado: string, mensaje: string): string {
  return `https://wa.me/${normalizado.replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`;
}

export async function cargarBandejaAdmin(): Promise<BandejaAdmin> {
  const ahora = new Date();
  const enSieteDias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const haceTreintaDias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

  const resumenConsulta = db.execute<FilaResumen>(sql`
    SELECT
      (SELECT count(*) FROM support_tickets WHERE status IN ('open','in_progress'))::int AS conversaciones,
      (SELECT count(*) FROM places WHERE review_status = 'pending')::int AS solicitudes_negocios,
      (SELECT count(*) FROM project_requests WHERE status = 'pending')::int AS solicitudes_proyectos,
      (SELECT count(*) FROM pagos WHERE estado = 'pendiente')::int AS pagos,
      (SELECT count(*) FROM suscripciones WHERE estado = 'activa' AND plan <> 'gratis' AND vence_en < now())::int AS cobros,
      (SELECT count(*) FROM suscripciones WHERE estado = 'activa' AND trial_hasta > now() AND trial_hasta <= now() + interval '7 days')::int AS pruebas,
      (SELECT count(*) FROM publicaciones WHERE estado <> 'publicada')::int AS publicaciones,
      (SELECT count(*) FROM places
        WHERE review_status = 'approved' AND is_active AND status = 'active'
          AND (tipo_negocio IS NULL
            OR coalesce(array_length(image_urls, 1), 0) = 0
            OR updated_at < now() - interval '30 days'))::int AS fichas,
      (SELECT count(*) FROM diagnosticos WHERE tipo IN ('mapa_error','error') AND creado_en >= now() - interval '7 days')::int AS diagnostico,
      (SELECT coalesce(sum(monto_centavos), 0) FROM pagos
        WHERE estado = 'pagado' AND pagado_en >= date_trunc('month', now()))::int AS ingreso_centavos,
      (SELECT count(*) FROM suscripciones
        WHERE estado = 'activa' AND plan <> 'gratis'
          AND (vence_en IS NULL OR vence_en > now()))::int AS negocios_pagando,
      (SELECT coalesce(sum(no_result_searches), 0) FROM analytics_daily
        WHERE day >= to_char(now() - interval '30 days', 'YYYY-MM-DD'))::int AS sin_resultado
  `);

  const [
    resumen,
    tickets,
    solicitudes,
    pagosPendientes,
    vencidas,
    pruebas,
    enCola,
    fichas,
    mercado,
    catalogo,
  ] = await Promise.all([
    resumenConsulta,
    db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        message: supportTickets.message,
        createdAt: supportTickets.createdAt,
        userSnapshot: supportTickets.userSnapshot,
        email: supportTickets.email,
      })
      .from(supportTickets)
      .where(inArray(supportTickets.status, ["open", "in_progress"]))
      .orderBy(asc(supportTickets.createdAt))
      .limit(6),
    db
      .select({
        id: places.id,
        name: places.name,
        city: places.city,
        province: places.province,
        imageUrls: places.imageUrls,
        hoursJson: places.hoursJson,
        horario: places.horario,
        tipoNegocio: places.tipoNegocio,
        phone: places.phone,
        lat: places.lat,
        lng: places.lng,
        createdAt: places.createdAt,
      })
      .from(places)
      .where(eq(places.reviewStatus, "pending"))
      .orderBy(asc(places.createdAt))
      .limit(6),
    db
      .select({
        id: pagos.id,
        negocioId: pagos.negocioId,
        metodo: pagos.metodo,
        tipo: pagos.tipo,
        clave: pagos.clave,
        montoCentavos: pagos.montoCentavos,
        createdAt: pagos.createdAt,
        negocio: places.name,
      })
      .from(pagos)
      .innerJoin(places, eq(pagos.negocioId, places.id))
      .where(eq(pagos.estado, "pendiente"))
      .orderBy(asc(pagos.createdAt))
      .limit(6),
    db
      .select({
        negocioId: suscripciones.negocioId,
        plan: suscripciones.plan,
        venceEn: suscripciones.venceEn,
        negocio: places.name,
        whatsapp: places.whatsapp,
      })
      .from(suscripciones)
      .innerJoin(places, eq(suscripciones.negocioId, places.id))
      .where(
        and(
          eq(suscripciones.estado, "activa"),
          sql`${suscripciones.plan} <> 'gratis'`,
          lt(suscripciones.venceEn, ahora),
        ),
      )
      .orderBy(asc(suscripciones.venceEn))
      .limit(6),
    db
      .select({
        negocioId: suscripciones.negocioId,
        trialHasta: suscripciones.trialHasta,
        negocio: places.name,
      })
      .from(suscripciones)
      .innerJoin(places, eq(suscripciones.negocioId, places.id))
      .where(
        and(
          eq(suscripciones.estado, "activa"),
          gte(suscripciones.trialHasta, ahora),
          lte(suscripciones.trialHasta, enSieteDias),
        ),
      )
      .orderBy(asc(suscripciones.trialHasta))
      .limit(6),
    db
      .select({
        id: publicaciones.id,
        estado: publicaciones.estado,
        createdAt: publicaciones.createdAt,
        negocioId: publicaciones.negocioId,
        negocio: places.name,
      })
      .from(publicaciones)
      .innerJoin(places, eq(publicaciones.negocioId, places.id))
      .where(sql`${publicaciones.estado} <> 'publicada'`)
      .orderBy(asc(publicaciones.createdAt))
      .limit(6),
    db
      .select({
        id: places.id,
        name: places.name,
        tipoNegocio: places.tipoNegocio,
        imageUrls: places.imageUrls,
        updatedAt: places.updatedAt,
      })
      .from(places)
      .where(
        and(
          eq(places.reviewStatus, "approved"),
          eq(places.isActive, true),
          eq(places.status, "active"),
          or(
            isNull(places.tipoNegocio),
            sql`coalesce(array_length(${places.imageUrls}, 1), 0) = 0`,
            lt(places.updatedAt, haceTreintaDias),
          ),
        ),
      )
      .orderBy(asc(places.updatedAt))
      .limit(6),
    tasaMercadoActual(),
    cargarCatalogo(),
  ]);

  const fila = resumen.rows[0];
  const conversaciones = fila?.conversaciones ?? 0;
  const solicitudesNegocios = fila?.solicitudes_negocios ?? 0;
  const solicitudesProyectos = fila?.solicitudes_proyectos ?? 0;
  const pagosPorConfirmar = fila?.pagos ?? 0;
  const cobrosVencidos = fila?.cobros ?? 0;
  const pruebasPorVencer = fila?.pruebas ?? 0;
  const publicacionesPorRevisar = fila?.publicaciones ?? 0;
  const fichasConProblemas = fila?.fichas ?? 0;
  const erroresMapa = fila?.diagnostico ?? 0;
  const ingresoCentavos = fila?.ingreso_centavos ?? 0;
  const negociosPagando = fila?.negocios_pagando ?? 0;
  const busquedasSinResultado = fila?.sin_resultado ?? 0;

  /* Teléfonos repetidos entre las solicitudes listadas: una consulta para
     todas, no una por ficha. */
  const telefonos = [
    ...new Set(solicitudes.map((s) => s.phone).filter(Boolean)),
  ];
  const repetidos = telefonos.length
    ? await db
        .select({ phone: places.phone, total: sql<number>`count(*)::int` })
        .from(places)
        .where(inArray(places.phone, telefonos as string[]))
        .groupBy(places.phone)
    : [];
  const telefonosRepetidos = new Set(
    repetidos.filter((r) => r.total > 1).map((r) => r.phone),
  );

  /* Teléfono del dueño para los cobros vencidos. Se prefiere el WhatsApp de la
     ficha y, si no hay, el del perfil del dueño. */
  const idsVencidos = vencidas.map((v) => v.negocioId);
  const duenos = idsVencidos.length
    ? await db
        .select({
          placeId: businessOwners.placeId,
          phone: users.phone,
        })
        .from(businessOwners)
        .innerJoin(users, eq(businessOwners.userId, users.id))
        .where(
          and(
            inArray(businessOwners.placeId, idsVencidos),
            eq(businessOwners.role, "owner"),
          ),
        )
    : [];
  const telefonoPorNegocio = new Map<string, string | null>();
  for (const dueno of duenos) {
    if (!telefonoPorNegocio.has(dueno.placeId)) {
      telefonoPorNegocio.set(dueno.placeId, dueno.phone);
    }
  }

  const pendientes: PendienteAdmin[] = [];

  for (const ticket of tickets) {
    const nombre =
      ticket.userSnapshot?.name ?? ticket.userSnapshot?.email ?? ticket.email;
    pendientes.push({
      clave: `soporte:${ticket.id}`,
      tipo: "soporte",
      etiquetaTipo: ETIQUETA.soporte,
      titulo: ticket.subject,
      detalle: `${nombre} · abierto el ${fechaCorta.format(ticket.createdAt)}`,
      prioridad: PRIORIDAD.soporte,
      fecha: ticket.createdAt.toISOString(),
      accion: {
        tipo: "abrir",
        href: `/admin/soporte?ticket=${ticket.id}`,
        etiqueta: "Responder",
      },
      accionSecundaria: null,
    });
  }

  for (const solicitud of solicitudes) {
    const revision = revisarSolicitud({
      fotos: (solicitud.imageUrls ?? []).length,
      tieneHorario:
        Boolean(solicitud.horario) ||
        Object.keys(solicitud.hoursJson ?? {}).length > 0,
      ubicacionValida:
        Number.isFinite(solicitud.lat) &&
        Number.isFinite(solicitud.lng) &&
        solicitud.lat >= 18 &&
        solicitud.lat <= 24 &&
        solicitud.lng >= -85 &&
        solicitud.lng <= -74,
      tipo: solicitud.tipoNegocio,
      telefonoDuplicado: telefonosRepetidos.has(solicitud.phone),
    });

    pendientes.push({
      clave: `solicitud:${solicitud.id}`,
      tipo: "solicitud",
      etiquetaTipo: ETIQUETA.solicitud,
      titulo: solicitud.name,
      detalle:
        revision.faltan.length > 0
          ? `${solicitud.city}, ${solicitud.province} · ${revision.faltan.join(" · ")}`
          : `${solicitud.city}, ${solicitud.province} · Revisión automática completa`,
      prioridad: PRIORIDAD.solicitud,
      fecha: solicitud.createdAt.toISOString(),
      accion: revision.completa
        ? { tipo: "aprobar_solicitud", negocioId: solicitud.id }
        : { tipo: "abrir", href: "/admin/solicitudes", etiqueta: "Revisar" },
      accionSecundaria: revision.completa
        ? { href: "/admin/solicitudes", etiqueta: "Ver solicitud" }
        : null,
    });
  }

  for (const pago of pagosPendientes) {
    const usd = pago.montoCentavos / 100;
    const concepto =
      pago.tipo === "plan"
        ? `Plan ${nombreDe(pago.clave as Plan, catalogo)}`
        : pago.tipo === "modulo"
          ? "Módulo suelto"
          : "Pack a medida";

    pendientes.push({
      clave: `pago:${pago.id}`,
      tipo: "pago",
      etiquetaTipo: ETIQUETA.pago,
      titulo: pago.negocio,
      detalle: `${usd.toLocaleString("es-CU", { maximumFractionDigits: 2 })} USD · ${concepto} · ${pago.metodo === "qvapay" ? "QvaPay" : "Cortesía"} · ${fechaCorta.format(pago.createdAt)}`,
      prioridad: PRIORIDAD.pago,
      fecha: pago.createdAt.toISOString(),
      accion: { tipo: "confirmar_pago", pagoId: pago.id },
      accionSecundaria: null,
    });
  }

  for (const vencida of vencidas) {
    const telefono = normalizarTelefono(
      vencida.whatsapp ?? telefonoPorNegocio.get(vencida.negocioId) ?? "",
    );
    const vencimiento = vencida.venceEn
      ? fechaCorta.format(vencida.venceEn)
      : "una fecha pasada";
    const plan = nombreDe(vencida.plan, catalogo);
    const mensaje = `Hola ${vencida.negocio}, te escribimos de La Verde. Tu plan ${plan} venció el ${vencimiento}. ¿Quieres renovarlo?`;

    pendientes.push({
      clave: `cobro:${vencida.negocioId}`,
      tipo: "cobro",
      etiquetaTipo: ETIQUETA.cobro,
      titulo: vencida.negocio,
      detalle: `Venció el ${vencimiento} · Plan ${plan}`,
      prioridad: PRIORIDAD.cobro,
      fecha: vencida.venceEn?.toISOString() ?? null,
      accion: telefono
        ? {
            tipo: "whatsapp",
            href: enlaceWhatsapp(telefono, mensaje),
            etiqueta: "Recordar",
          }
        : {
            tipo: "abrir",
            href: `/admin/negocios/${vencida.negocioId}/editar`,
            etiqueta: "Ofrecer plan",
          },
      accionSecundaria: {
        href: `/admin/negocios/${vencida.negocioId}/editar`,
        etiqueta: "Ver negocio",
      },
    });
  }

  const unDia = 24 * 60 * 60 * 1000;
  for (const prueba of pruebas) {
    if (!prueba.trialHasta) continue;
    const dias = Math.max(
      0,
      Math.ceil((prueba.trialHasta.getTime() - ahora.getTime()) / unDia),
    );

    pendientes.push({
      clave: `prueba:${prueba.negocioId}`,
      tipo: "prueba",
      etiquetaTipo: ETIQUETA.prueba,
      titulo: prueba.negocio,
      detalle: `La prueba termina el ${fechaCorta.format(prueba.trialHasta)} · ${dias === 0 ? "hoy" : dias === 1 ? "queda 1 día" : `quedan ${dias} días`}`,
      prioridad: PRIORIDAD.prueba,
      fecha: prueba.trialHasta.toISOString(),
      accion: {
        tipo: "abrir",
        href: `/admin/negocios/${prueba.negocioId}/editar`,
        etiqueta: "Ofrecer plan",
      },
      accionSecundaria: null,
    });
  }

  for (const publicacion of enCola) {
    pendientes.push({
      clave: `publicacion:${publicacion.id}`,
      tipo: "publicacion",
      etiquetaTipo: ETIQUETA.publicacion,
      titulo: publicacion.negocio,
      detalle: `Publicación en ${publicacion.estado === "borrador" ? "borrador" : "lista"} · ${fechaCorta.format(publicacion.createdAt)}`,
      prioridad: PRIORIDAD.publicacion,
      fecha: publicacion.createdAt.toISOString(),
      accion: {
        tipo: "abrir",
        href: "/admin/publicaciones",
        etiqueta: "Revisar",
      },
      accionSecundaria: null,
    });
  }

  for (const ficha of fichas) {
    const razones: string[] = [];
    if (!ficha.tipoNegocio) razones.push("Sin tipo");
    if ((ficha.imageUrls ?? []).length === 0) razones.push("Sin fotos");
    const diasSinActividad = Math.floor(
      (ahora.getTime() - ficha.updatedAt.getTime()) / unDia,
    );
    if (diasSinActividad > 30) {
      razones.push(`Sin actividad desde ${fechaCorta.format(ficha.updatedAt)}`);
    }

    pendientes.push({
      clave: `ficha:${ficha.id}`,
      tipo: "ficha",
      etiquetaTipo: ETIQUETA.ficha,
      titulo: ficha.name,
      detalle: razones.join(" · ") || "Ficha incompleta",
      prioridad: PRIORIDAD.ficha,
      fecha: ficha.updatedAt.toISOString(),
      accion: {
        tipo: "abrir",
        href: `/admin/negocios/${ficha.id}/editar`,
        etiqueta: "Abrir ficha",
      },
      accionSecundaria: null,
    });
  }

  if (erroresMapa > 0) {
    pendientes.push({
      clave: "diagnostico:mapa",
      tipo: "diagnostico",
      etiquetaTipo: ETIQUETA.diagnostico,
      titulo: "Errores de Diagnóstico",
      detalle: `${erroresMapa} ${erroresMapa === 1 ? "error registrado" : "errores registrados"} en los últimos 7 días · mapa e hidratación`,
      prioridad: PRIORIDAD.diagnostico,
      fecha: null,
      accion: {
        tipo: "abrir",
        href: "/admin/diagnostico",
        etiqueta: "Ver Diagnóstico",
      },
      accionSecundaria: null,
    });
  }

  pendientes.sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
    if (a.fecha && b.fecha) return a.fecha.localeCompare(b.fecha);
    return 0;
  });

  const total =
    conversaciones +
    solicitudesNegocios +
    solicitudesProyectos +
    pagosPorConfirmar +
    cobrosVencidos +
    pruebasPorVencer +
    publicacionesPorRevisar +
    fichasConProblemas +
    (erroresMapa > 0 ? 1 : 0);

  const ingresoUsd = ingresoCentavos / 100;
  const tasaUsdCup = mercado?.usdCup ?? (catalogo.tasaCup || null);

  return {
    total,
    pendientes,
    erroresMapa,
    cifras: {
      ingresoCentavos,
      ingresoUsd,
      ingresoCup: tasaUsdCup ? Math.round(ingresoUsd * tasaUsdCup) : null,
      tasaUsdCup,
      negociosPagando,
      pruebasPorVencer,
      busquedasSinResultado,
    },
  };
}

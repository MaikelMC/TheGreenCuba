import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import { businessOwners, categories, places, users } from "@/lib/db/schema";
import { puntosFicha } from "@/lib/ficha/completitud";
import {
  TIPOS_NEGOCIO,
  TIPO_NEGOCIO_LABEL,
  type TipoNegocio,
} from "@/lib/ficha/tipos";
import { nombreDe, PLAN_ORDER, type Plan } from "@/lib/plans";

/**
 * La lista de Negocios del panel, calculada en el servidor.
 *
 * La tabla no baja la tabla `places` al navegador: filtra, ordena y pagina en
 * Postgres. Los contadores de las chapitas salen de una sola consulta agregada
 * y los estados de pago y ficha se resuelven con las mismas reglas que la ficha
 * 360, para que un negocio no se lea distinto en las dos pantallas.
 */

export const FILTROS_NEGOCIOS = [
  "todos",
  "prueba",
  "impagos",
  "sin_fotos",
  "sin_actividad",
  "sin_tipo",
] as const;

export type FiltroNegocios = (typeof FILTROS_NEGOCIOS)[number];

export const ORDENES_NEGOCIOS = [
  "nombre",
  "plan",
  "pago",
  "ficha",
  "actividad",
  "visitas",
  "estado",
  "alta",
] as const;

export type OrdenNegocios = (typeof ORDENES_NEGOCIOS)[number];
export type DireccionOrden = "asc" | "desc";
export type EstadoNegocioFiltro =
  "todos" | "activos" | "inactivos" | "destacados";

export type EstadoPagoNegocio =
  "al_dia" | "prueba" | "vencida" | "pendiente" | "gratis" | "cancelada";

export type EstadoPublicacionNegocio =
  "publicado" | "pendiente" | "rechazado" | "oculto" | "cerrado" | "temporal";

export type PagoNegocio = {
  estado: EstadoPagoNegocio;
  etiqueta: string;
  detalle: string;
};

export type NegocioAdminFila = {
  id: string;
  name: string;
  categoria: string | null;
  tipo: TipoNegocio | null;
  tipoLabel: string;
  ubicacion: string;
  plan: {
    efectivo: Plan;
    nombre: string;
    contratado: Plan;
    contratadoNombre: string;
    estado: "activa" | "cancelada";
    trialHasta: string | null;
    venceEn: string | null;
  };
  pago: PagoNegocio;
  /** Pack a medida pagado y vigente. Se suma al plan estándar. */
  pack: {
    vigente: boolean;
    precioUsd: number | null;
    venceEn: string | null;
  } | null;
  ficha: { pct: number; faltan: string[] };
  ultimaActividad: string | null;
  diasSinActividad: number;
  alta: string | null;
  visitas30: number;
  estado: EstadoPublicacionNegocio;
  isActive: boolean;
  isBoosted: boolean;
  reviewStatus: string;
};

export type DatosNegociosAdmin = {
  filas: NegocioAdminFila[];
  total: number;
  pagina: number;
  paginas: number;
  porPagina: number;
  conteos: Record<FiltroNegocios, number>;
  categorias: { id: string; nombre: string }[];
  planes: { id: Plan; nombre: string }[];
  filtros: {
    filtro: FiltroNegocios;
    q: string;
    categoria: string;
    plan: Plan | "";
    estado: EstadoNegocioFiltro;
    tipo: TipoNegocio | "sin_tipo" | "";
    orden: OrdenNegocios;
    dir: DireccionOrden;
  };
};

export type DirectorioNegocio = {
  id: string;
  email: string;
  name: string | null;
};

type Parametros = Record<string, string | string[] | undefined>;

type FilaSql = {
  id: string;
  name: string;
  city: string;
  province: string;
  neighborhood: string | null;
  tipo_negocio: string | null;
  categoria: string | null;
  logo_url: string | null;
  image_urls: string[] | null;
  description: string | null;
  horario: unknown;
  schedule: string | null;
  whatsapp: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  status: string;
  review_status: string;
  is_boosted: boolean;
  created_at: Date;
  updated_at: Date;
  plan_contratado: string | null;
  suscripcion_estado: string | null;
  trial_hasta: Date | null;
  vence_en: Date | null;
  plan_efectivo: string;
  pago_pendiente: boolean;
  pack_vigente: boolean;
  pack_precio_usd: number | null;
  pack_vence_en: Date | null;
  visitas30: number;
};

type ConteosSql = Record<FiltroNegocios, number>;

const POR_PAGINA = 20;

const PLAN_EFECTIVO = sql`(
  CASE
    WHEN s.estado = 'activa'
      AND s.trial_hasta IS NOT NULL
      AND s.trial_hasta > (now() AT TIME ZONE 'America/Havana')
      THEN 'pro'
    WHEN s.estado = 'activa'
      AND s.plan <> 'gratis'
      AND (s.vence_en IS NULL OR s.vence_en > (now() AT TIME ZONE 'America/Havana'))
      THEN s.plan
    ELSE 'gratis'
  END
)`;

const VISITAS_30 = sql`(
  SELECT count(*)::int
  FROM analytics_events ae
  WHERE ae.business_id = p.id
    AND ae.event_type = 'business_viewed'
    AND ae.created_at >= now() - interval '30 days'
)`;

const FICHA_PCT = sql`(
  (CASE WHEN coalesce(p.logo_url, '') <> '' OR coalesce(array_length(p.image_urls, 1), 0) > 0 THEN 1 ELSE 0 END) +
  (CASE WHEN length(trim(coalesce(p.description, ''))) >= 30 THEN 1 ELSE 0 END) +
  (CASE WHEN p.horario IS NOT NULL OR coalesce(trim(p.schedule), '') <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN p.lat IS NOT NULL AND p.lng IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN coalesce(trim(p.whatsapp), '') <> '' OR coalesce(trim(p.phone), '') <> '' THEN 1 ELSE 0 END)
)`;

const FECHA = new Intl.DateTimeFormat("es-CU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Havana",
});

function primero(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

function esPlan(valor: string | null | undefined): valor is Plan {
  return Boolean(valor) && PLAN_ORDER.includes(valor as Plan);
}

function esFiltro(valor: string): valor is FiltroNegocios {
  return (FILTROS_NEGOCIOS as readonly string[]).includes(valor);
}

function esOrden(valor: string): valor is OrdenNegocios {
  return (ORDENES_NEGOCIOS as readonly string[]).includes(valor);
}

function esEstadoFiltro(valor: string): valor is EstadoNegocioFiltro {
  return ["todos", "activos", "inactivos", "destacados"].includes(valor);
}

function fecha(valor: Date | string | null | undefined): Date | null {
  if (!valor) return null;
  const fechaValor = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fechaValor.getTime()) ? null : fechaValor;
}

function formatearFecha(
  valor: Date | string | null | undefined,
): string | null {
  const fechaValor = fecha(valor);
  return fechaValor ? FECHA.format(fechaValor) : null;
}

function diasHasta(valor: Date, ahora: number): number {
  return Math.ceil((valor.getTime() - ahora) / 86_400_000);
}

function diasDesde(valor: Date, ahora: number): number {
  return Math.max(0, Math.floor((ahora - valor.getTime()) / 86_400_000));
}

function calcularPago({
  pendiente,
  suscripcion,
  planContratado,
  trialHasta,
  venceEn,
  packVigente,
  packPrecioUsd,
  packVenceEn,
  ahora,
}: {
  pendiente: boolean;
  suscripcion: "activa" | "cancelada";
  planContratado: Plan;
  trialHasta: Date | null;
  venceEn: Date | null;
  packVigente: boolean;
  packPrecioUsd: number | null;
  packVenceEn: Date | null;
  ahora: number;
}): PagoNegocio {
  if (pendiente) {
    return {
      estado: "pendiente",
      etiqueta: "Por confirmar",
      detalle: "Hay un pago esperando confirmación.",
    };
  }

  if (suscripcion === "activa" && trialHasta && trialHasta.getTime() > ahora) {
    const quedan = diasHasta(trialHasta, ahora);
    return {
      estado: "prueba",
      etiqueta: "En prueba",
      detalle: `Quedan ${quedan} ${quedan === 1 ? "día" : "días"} de prueba · termina el ${formatearFecha(trialHasta)}.`,
    };
  }

  if (
    packVigente &&
    packVenceEn &&
    (planContratado === "gratis" ||
      suscripcion === "cancelada" ||
      (venceEn !== null && venceEn.getTime() < ahora))
  ) {
    return {
      estado: "al_dia",
      etiqueta: "Pack activo",
      detalle: `${packPrecioUsd !== null ? `${packPrecioUsd} USD/mes · ` : ""}Activo hasta el ${formatearFecha(packVenceEn)}${suscripcion === "cancelada" ? " · Suscripción estándar cancelada" : ""}.`,
    };
  }

  if (suscripcion === "cancelada") {
    return {
      estado: "cancelada",
      etiqueta: "Cancelada",
      detalle: "La suscripción está cancelada.",
    };
  }

  if (planContratado !== "gratis" && venceEn && venceEn.getTime() < ahora) {
    const dias = diasDesde(venceEn, ahora);
    return {
      estado: "vencida",
      etiqueta: "Impago",
      detalle: `Venció hace ${dias} ${dias === 1 ? "día" : "días"} · ${formatearFecha(venceEn)}.`,
    };
  }

  if (planContratado === "gratis") {
    return {
      estado: "gratis",
      etiqueta: "Gratis",
      detalle: "Sin plan de pago.",
    };
  }

  if (venceEn) {
    const quedan = diasHasta(venceEn, ahora);
    return {
      estado: "al_dia",
      etiqueta: "Al día",
      detalle:
        quedan >= 0
          ? `Vence en ${quedan} ${quedan === 1 ? "día" : "días"} · ${formatearFecha(venceEn)}.`
          : `Vence el ${formatearFecha(venceEn)}.`,
    };
  }

  return {
    estado: "al_dia",
    etiqueta: "Al día",
    detalle: "Plan activo sin vencimiento.",
  };
}

function calcularEstadoPublicacion({
  isActive,
  status,
  reviewStatus,
}: {
  isActive: boolean;
  status: string;
  reviewStatus: string;
}): EstadoPublicacionNegocio {
  if (!isActive) return reviewStatus === "pending" ? "pendiente" : "oculto";
  if (status === "closed") return "cerrado";
  if (status === "temporary_closed") return "temporal";
  if (reviewStatus === "pending") return "pendiente";
  if (reviewStatus === "rejected") return "rechazado";
  return "publicado";
}

function leerFiltros(params: Parametros): DatosNegociosAdmin["filtros"] {
  const filtroCrudo = primero(params.filtro);
  const estadoCrudo = primero(params.estado);
  const tipoCrudo = primero(params.tipo);
  const planCrudo = primero(params.plan);
  const ordenCrudo = primero(params.orden);

  const tipo: TipoNegocio | "sin_tipo" | "" =
    tipoCrudo === "sin_tipo"
      ? "sin_tipo"
      : (TIPOS_NEGOCIO as readonly string[]).includes(tipoCrudo)
        ? (tipoCrudo as TipoNegocio)
        : "";

  return {
    filtro: esFiltro(filtroCrudo) ? filtroCrudo : "todos",
    q: primero(params.q).trim().slice(0, 80),
    categoria: primero(params.categoria).trim().slice(0, 80),
    plan: esPlan(planCrudo) ? planCrudo : "",
    estado: esEstadoFiltro(estadoCrudo) ? estadoCrudo : "todos",
    tipo,
    orden: esOrden(ordenCrudo) ? ordenCrudo : "actividad",
    dir: primero(params.dir) === "asc" ? "asc" : "desc",
  };
}

export async function cargarNegociosAdmin(
  params: Parametros,
): Promise<DatosNegociosAdmin> {
  const filtros = leerFiltros(params);
  const paginaPedida = Math.min(
    Math.max(Number.parseInt(primero(params.pagina), 10) || 1, 1),
    100_000,
  );
  const q = filtros.q.toLowerCase();

  const busqueda = q
    ? sql` AND (
        strpos(lower(p.name), ${q}) > 0
        OR strpos(lower(coalesce(p.city, '')), ${q}) > 0
        OR strpos(lower(coalesce(p.province, '')), ${q}) > 0
        OR strpos(lower(coalesce(p.neighborhood, '')), ${q}) > 0
        OR strpos(lower(coalesce(p.address, '')), ${q}) > 0
        OR strpos(lower(coalesce(p.phone, '')), ${q}) > 0
        OR strpos(lower(coalesce(p.whatsapp, '')), ${q}) > 0
        OR strpos(lower(c.name), ${q}) > 0
        OR EXISTS (
          SELECT 1
          FROM business_owners bo2
          JOIN users u2 ON u2.id = bo2.user_id
          WHERE bo2.place_id = p.id
            AND (
              strpos(lower(coalesce(u2.name, '')), ${q}) > 0
              OR strpos(lower(u2.email), ${q}) > 0
            )
        )
      )`
    : sql``;

  const filtroChip =
    filtros.filtro === "prueba"
      ? sql` AND s.estado = 'activa' AND s.trial_hasta IS NOT NULL            AND s.trial_hasta > (now() AT TIME ZONE 'America/Havana')
            AND s.trial_hasta <= (now() AT TIME ZONE 'America/Havana') + interval '7 days'`
      : filtros.filtro === "impagos"
        ? sql` AND (
            EXISTS (
              SELECT 1 FROM pagos pa
              WHERE pa.negocio_id = p.id AND pa.estado = 'pendiente'
            )
            OR (
              s.estado = 'activa'
              AND s.plan <> 'gratis'
              AND s.vence_en IS NOT NULL
              AND s.vence_en < (now() AT TIME ZONE 'America/Havana')
            )
          )`
        : filtros.filtro === "sin_fotos"
          ? sql` AND coalesce(array_length(p.image_urls, 1), 0) = 0`
          : filtros.filtro === "sin_actividad"
            ? sql` AND p.updated_at < now() - interval '30 days'`
            : filtros.filtro === "sin_tipo"
              ? sql` AND p.tipo_negocio IS NULL`
              : sql``;

  const categoria = filtros.categoria
    ? sql` AND p.category_id = ${filtros.categoria}`
    : sql``;

  const plan = filtros.plan
    ? sql` AND ${PLAN_EFECTIVO} = ${filtros.plan}`
    : sql``;

  const estado =
    filtros.estado === "activos"
      ? sql` AND p.is_active = true AND p.status = 'active'`
      : filtros.estado === "inactivos"
        ? sql` AND (p.is_active = false OR p.status <> 'active')`
        : filtros.estado === "destacados"
          ? sql` AND p.is_boosted = true`
          : sql``;

  const tipo =
    filtros.tipo === "sin_tipo"
      ? sql` AND p.tipo_negocio IS NULL`
      : filtros.tipo
        ? sql` AND p.tipo_negocio = ${filtros.tipo}`
        : sql``;

  const where = sql`TRUE ${filtroChip} ${busqueda} ${categoria} ${plan} ${estado} ${tipo}`;

  const [conteosRes, totalRes, categoriasRes, catalogo] = await Promise.all([
    db.execute<ConteosSql>(sql`
      SELECT
        count(*)::int AS todos,
        count(*) FILTER (
          WHERE s.estado = 'activa'
            AND s.trial_hasta IS NOT NULL
            AND s.trial_hasta > (now() AT TIME ZONE 'America/Havana')
            AND s.trial_hasta <= (now() AT TIME ZONE 'America/Havana') + interval '7 days'
        )::int AS prueba,
        count(*) FILTER (
          WHERE EXISTS (
              SELECT 1 FROM pagos pa
              WHERE pa.negocio_id = p.id AND pa.estado = 'pendiente'
            )
            OR (
              s.estado = 'activa'
              AND s.plan <> 'gratis'
              AND s.vence_en IS NOT NULL
              AND s.vence_en < (now() AT TIME ZONE 'America/Havana')
            )
        )::int AS impagos,
        count(*) FILTER (
          WHERE coalesce(array_length(p.image_urls, 1), 0) = 0
        )::int AS sin_fotos,
        count(*) FILTER (
          WHERE p.updated_at < now() - interval '30 days'
        )::int AS sin_actividad,
        count(*) FILTER (WHERE p.tipo_negocio IS NULL)::int AS sin_tipo
      FROM places p
      LEFT JOIN suscripciones s ON s.negocio_id = p.id
    `),
    db.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total
      FROM places p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN suscripciones s ON s.negocio_id = p.id
      WHERE ${where}
    `),
    db
      .select({ id: categories.id, nombre: categories.name })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    cargarCatalogo(),
  ]);

  const conteos: Record<FiltroNegocios, number> = {
    todos: conteosRes.rows[0]?.todos ?? 0,
    prueba: conteosRes.rows[0]?.prueba ?? 0,
    impagos: conteosRes.rows[0]?.impagos ?? 0,
    sin_fotos: conteosRes.rows[0]?.sin_fotos ?? 0,
    sin_actividad: conteosRes.rows[0]?.sin_actividad ?? 0,
    sin_tipo: conteosRes.rows[0]?.sin_tipo ?? 0,
  };

  const total = totalRes.rows[0]?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(paginaPedida, paginas);
  const desplazamiento = (pagina - 1) * POR_PAGINA;

  const direccion = sql.raw(filtros.dir === "asc" ? "ASC" : "DESC");
  let orden: SQL;
  switch (filtros.orden) {
    case "nombre":
      orden = sql`p.name ${direccion}, p.id ASC`;
      break;
    case "plan":
      orden = sql`array_position(ARRAY['gratis', 'esencial', 'publicidad_max', 'pro']::text[], ${PLAN_EFECTIVO}) ${direccion}, p.id ASC`;
      break;
    case "pago":
      orden = sql`coalesce(s.vence_en, s.trial_hasta) ${direccion} NULLS LAST, p.id ASC`;
      break;
    case "ficha":
      orden = sql`${FICHA_PCT} ${direccion}, p.id ASC`;
      break;
    case "visitas":
      orden = sql`${VISITAS_30} ${direccion}, p.id ASC`;
      break;
    case "estado":
      orden = sql`p.is_active ${direccion}, p.status ${direccion}, p.id ASC`;
      break;
    case "alta":
      orden = sql`p.created_at ${direccion}, p.id ASC`;
      break;
    case "actividad":
    default:
      orden = sql`p.updated_at ${direccion}, p.id ASC`;
      break;
  }

  const filasRes = await db.execute<FilaSql>(sql`
    SELECT
      p.id,
      p.name,
      p.city,
      p.province,
      p.neighborhood,
      p.tipo_negocio,
      c.name AS categoria,
      p.logo_url,
      p.image_urls,
      p.description,
      p.horario,
      p.schedule,
      p.whatsapp,
      p.phone,
      p.lat,
      p.lng,
      p.is_active,
      p.status,
      p.review_status,
      p.is_boosted,
      p.created_at,
      p.updated_at,
      s.plan AS plan_contratado,
      s.estado AS suscripcion_estado,
      s.trial_hasta,
      s.vence_en,
      ${PLAN_EFECTIVO} AS plan_efectivo,
      EXISTS (
        SELECT 1 FROM pagos pa
        WHERE pa.negocio_id = p.id AND pa.estado = 'pendiente'
      ) AS pago_pendiente,
      EXISTS (
        SELECT 1 FROM packs_medida pm
        WHERE pm.negocio_id = p.id
          AND pm.estado = 'pagado'
          AND pm.vence_en IS NOT NULL
          AND pm.vence_en > now()
      ) AS pack_vigente,
      (
        SELECT pm.precio_usd FROM packs_medida pm
        WHERE pm.negocio_id = p.id
          AND pm.estado = 'pagado'
          AND pm.vence_en IS NOT NULL
          AND pm.vence_en > now()
        ORDER BY pm.vence_en DESC
        LIMIT 1
      ) AS pack_precio_usd,
      (
        SELECT pm.vence_en FROM packs_medida pm
        WHERE pm.negocio_id = p.id
          AND pm.estado = 'pagado'
          AND pm.vence_en IS NOT NULL
          AND pm.vence_en > now()
        ORDER BY pm.vence_en DESC
        LIMIT 1
      ) AS pack_vence_en,
      ${VISITAS_30} AS visitas30
    FROM places p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN suscripciones s ON s.negocio_id = p.id
    WHERE ${where}
    ORDER BY ${orden}
    LIMIT ${POR_PAGINA}
    OFFSET ${desplazamiento}
  `);

  const ahora = Date.now();
  const filas = filasRes.rows.map((fila): NegocioAdminFila => {
    const trialHasta = fecha(fila.trial_hasta);
    const venceEn = fecha(fila.vence_en);
    const planContratado = esPlan(fila.plan_contratado)
      ? fila.plan_contratado
      : "gratis";
    const planEfectivo = esPlan(fila.plan_efectivo)
      ? fila.plan_efectivo
      : "gratis";
    const suscripcion =
      fila.suscripcion_estado === "cancelada" ? "cancelada" : "activa";
    const packVenceEn = fecha(fila.pack_vence_en);
    const pack = fila.pack_vigente
      ? {
          vigente: true,
          precioUsd: fila.pack_precio_usd ?? null,
          venceEn: formatearFecha(packVenceEn),
        }
      : null;
    const tipoNegocio =
      fila.tipo_negocio &&
      (TIPOS_NEGOCIO as readonly string[]).includes(fila.tipo_negocio)
        ? (fila.tipo_negocio as TipoNegocio)
        : null;
    const fotos = Array.isArray(fila.image_urls) ? fila.image_urls.length : 0;
    const puntos = puntosFicha({
      logoUrl: fila.logo_url,
      fotos,
      description: fila.description,
      tieneHorario: Boolean(fila.horario) || Boolean(fila.schedule?.trim()),
      lat: fila.lat,
      lng: fila.lng,
      whatsapp: fila.whatsapp,
      phone: fila.phone,
    });
    const pct = Math.round(
      (puntos.filter((punto) => punto.ok).length / puntos.length) * 100,
    );
    const ultimaActividad = fecha(fila.updated_at);

    return {
      id: fila.id,
      name: fila.name,
      categoria: fila.categoria,
      tipo: tipoNegocio,
      tipoLabel: tipoNegocio
        ? TIPO_NEGOCIO_LABEL[tipoNegocio]
        : "Sin tipo asignado",
      ubicacion:
        [fila.neighborhood, fila.city].filter(Boolean).join(", ") ||
        fila.province,
      plan: {
        efectivo: planEfectivo,
        nombre: nombreDe(planEfectivo, catalogo),
        contratado: planContratado,
        contratadoNombre: nombreDe(planContratado, catalogo),
        estado: suscripcion,
        trialHasta: formatearFecha(trialHasta),
        venceEn: formatearFecha(venceEn),
      },
      pago: calcularPago({
        pendiente: fila.pago_pendiente,
        suscripcion,
        planContratado,
        trialHasta,
        venceEn,
        packVigente: fila.pack_vigente,
        packPrecioUsd: fila.pack_precio_usd ?? null,
        packVenceEn,
        ahora,
      }),
      pack,
      ficha: {
        pct,
        faltan: puntos.filter((punto) => !punto.ok).map((punto) => punto.falta),
      },
      ultimaActividad: formatearFecha(ultimaActividad),
      diasSinActividad: ultimaActividad ? diasDesde(ultimaActividad, ahora) : 0,
      alta: formatearFecha(fila.created_at),
      visitas30: fila.visitas30,
      estado: calcularEstadoPublicacion({
        isActive: fila.is_active,
        status: fila.status,
        reviewStatus: fila.review_status,
      }),
      isActive: fila.is_active,
      isBoosted: fila.is_boosted,
      reviewStatus: fila.review_status,
    };
  });

  return {
    filas,
    total,
    pagina,
    paginas,
    porPagina: POR_PAGINA,
    conteos,
    categorias: categoriasRes,
    planes: PLAN_ORDER.map((clave) => ({
      id: clave,
      nombre: nombreDe(clave, catalogo),
    })),
    filtros,
  };
}

/**
 * Los dueños de los negocios elegidos, para precargar Notificaciones.
 *
 * Se deduplican: un negocio con dos dueños no puede producir dos avisos a la
 * misma persona ni dos entradas en la selección.
 */
export async function propietariosDeNegocios(
  ids: string[],
): Promise<DirectorioNegocio[]> {
  if (ids.length === 0) return [];

  return db
    .selectDistinct({ id: users.id, email: users.email, name: users.name })
    .from(businessOwners)
    .innerJoin(users, eq(users.id, businessOwners.userId))
    .where(
      and(
        inArray(businessOwners.placeId, ids),
        sql`${users.authUserId} IN (SELECT id::text FROM neon_auth.user)`,
      ),
    )
    .orderBy(asc(users.name));
}

/** Lee `?negocios=id1,id2` con un tope defensivo de 100 ids. */
export function leerIdsNegocios(
  valor: string | string[] | undefined,
): string[] {
  const crudo = Array.isArray(valor) ? valor.join(",") : (valor ?? "");
  return [
    ...new Set(
      crudo
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].slice(0, 100);
}

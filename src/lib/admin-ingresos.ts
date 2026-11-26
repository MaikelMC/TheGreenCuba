import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import { listarAfiliados } from "@/lib/afiliados";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { whatsappHref } from "@/lib/contact-links";
import { db } from "@/lib/db";
import {
  businessOwners,
  pagos,
  places,
  suscripciones,
  users,
} from "@/lib/db/schema";
import {
  PLAN_ORDER,
  nombreDe,
  precioConDescuento,
  type Catalogo,
  type ClaveModulo,
  type Plan,
  type TasaCupFuente,
} from "@/lib/plans";
import { normalizarTelefono } from "@/lib/telefono";

/**
 * Las cifras de Ingresos y pagos.
 *
 * Hay **dos verdades distintas** y no se mezclan:
 *
 * - **Facturado**: los pagos que ya están en `pagos` como `pagado` este mes.
 *   Es dinero que entró, venga de QvaPay o de una confirmación manual.
 * - **Recurrente esperado**: lo que deberían facturar las suscripciones activas
 *   al precio del catálogo. No es dinero cobrado; es la foto de lo contratado.
 *
 * Lo que el esquema no puede contar —conversión de prueba a pago y bajas del
 * mes— no se inventa: no hay historial de estados de suscripción, solo la fila
 * actual. La página lo dice en vez de pintar una cifra falsa.
 */

const DIA = 86_400_000;
const ORDEN_GRUPO: Record<GrupoCobro, number> = {
  vencido: 0,
  por_confirmar: 1,
  prueba: 2,
};

const FECHA_CORTA = new Intl.DateTimeFormat("es-CU", {
  day: "numeric",
  month: "short",
  timeZone: "America/Havana",
});

const FECHA_HORA = new Intl.DateTimeFormat("es-CU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Havana",
});

export type GrupoCobro = "vencido" | "por_confirmar" | "prueba";

export type AccionCobro =
  | { tipo: "confirmar"; pagoId: string }
  | { tipo: "whatsapp"; href: string }
  | { tipo: "ofrecer"; href: string };

export interface CobroPendiente {
  id: string;
  grupo: GrupoCobro;
  negocioId: string;
  negocio: string;
  detalle: string;
  fecha: string;
  montoCentavos: number | null;
  accion: AccionCobro;
}

export interface OrigenDinero {
  tipo: "plan" | "modulo" | "pack_medida";
  clave: string;
  nombre: string;
  montoCentavos: number;
  /** Porcentaje del facturado del mes, sin redondear. */
  porcentaje: number;
}

export interface PlanPagando {
  clave: Plan | "modulos";
  nombre: string;
  negocios: number;
  montoCentavos: number;
}

export interface DatosIngresosAdmin {
  /** `YYYY-MM` en UTC, el mismo mes que usa Afiliados. */
  mes: string;
  facturadoCentavos: number;
  facturadoCup: number;
  recurrenteCentavos: number;
  recurrenteCup: number;
  comisionesCentavos: number;
  comisionesCup: number;
  netoCentavos: number;
  netoCup: number;
  tasaCup: number;
  tasaFuente: TasaCupFuente;
  tasaActualizadaEn: string | null;
  negociosPagando: number;
  porPlan: PlanPagando[];
  origenes: OrigenDinero[];
  cobros: CobroPendiente[];
  afiliados: {
    pagosReferidosCentavos: number;
    comisionesCentavos: number;
    descuadre: boolean;
  };
}

interface FilaPago {
  id: string;
  negocioId: string;
  negocio: string;
  tipo: "plan" | "modulo" | "pack_medida";
  clave: string;
  metodo: "qvapay" | "cortesia" | "manual";
  montoCentavos: number;
  pagadoEn: Date | null;
  createdAt: Date;
}

interface FilaSuscripcion {
  negocioId: string;
  plan: Plan;
  venceEn: Date | null;
  descuentoPct: number | null;
  modulos: { clave: string; desde: string; hasta: string | null }[];
}

interface FilaVencida {
  negocioId: string;
  negocio: string;
  plan: Plan;
  venceEn: Date | null;
  descuentoPct: number | null;
  modulos: { clave: string; desde: string; hasta: string | null }[];
  whatsapp: string | null;
  telefonoDueno: string | null;
}

interface FilaPrueba {
  negocioId: string;
  negocio: string;
  trialHasta: Date | null;
}

function mesDe(ahora: Date): { inicio: Date; fin: Date; clave: string } {
  const anio = ahora.getUTCFullYear();
  const mes = ahora.getUTCMonth();
  return {
    inicio: new Date(Date.UTC(anio, mes, 1)),
    fin: new Date(Date.UTC(anio, mes + 1, 1)),
    clave: `${anio}-${String(mes + 1).padStart(2, "0")}`,
  };
}

function centavosDeUsd(usd: number): number {
  return Math.round(usd * 100);
}

function cupDe(centavos: number, tasa: number): number {
  return Math.round((centavos / 100) * tasa);
}

function planCentavos(
  plan: Plan,
  descuentoPct: number | null,
  cat: Catalogo,
): number {
  if (plan === "gratis") return 0;
  const pack = cat.packs[plan];
  if (!pack) return 0;
  return centavosDeUsd(precioConDescuento(pack.usd, descuentoPct).final);
}

function modulosVigentesCentavos(
  modulos: { clave: string; hasta: string | null }[],
  cat: Catalogo,
  ahora: Date,
): number {
  let total = 0;
  for (const modulo of modulos) {
    if (modulo.hasta && new Date(modulo.hasta).getTime() <= ahora.getTime()) {
      continue;
    }
    const precio = cat.modulos[modulo.clave as ClaveModulo]?.usd;
    if (typeof precio === "number" && Number.isFinite(precio)) {
      total += centavosDeUsd(precio);
    }
  }
  return total;
}

function conceptoDe(
  tipo: FilaPago["tipo"],
  clave: string,
  cat: Catalogo,
): string {
  if (tipo === "plan") {
    return clave in cat.packs ? nombreDe(clave as Plan, cat) : clave;
  }
  if (tipo === "modulo") {
    return cat.modulos[clave as ClaveModulo]?.nombre ?? clave;
  }
  return "Pack a medida";
}

function enlaceWhatsapp(mensaje: string, telefono: string | null): string | null {
  if (!telefono) return null;
  const base = whatsappHref(telefono);
  return base ? `${base}?text=${encodeURIComponent(mensaje)}` : null;
}

export async function cargarIngresosAdmin(
  ahora = new Date(),
): Promise<DatosIngresosAdmin> {
  const { inicio, fin, clave: mes } = mesDe(ahora);
  const enSieteDias = new Date(ahora.getTime() + 7 * DIA);

  const [cat, afiliados, pagosDelMes, pagosPendientes, vencidas, pruebas, activas, referidos] =
    await Promise.all([
      cargarCatalogo(),
      listarAfiliados(),
      db
        .select({
          id: pagos.id,
          negocioId: pagos.negocioId,
          negocio: places.name,
          tipo: pagos.tipo,
          clave: pagos.clave,
          metodo: pagos.metodo,
          montoCentavos: pagos.montoCentavos,
          pagadoEn: pagos.pagadoEn,
          createdAt: pagos.createdAt,
        })
        .from(pagos)
        .innerJoin(places, eq(places.id, pagos.negocioId))
        .where(
          and(
            eq(pagos.estado, "pagado"),
            sql`coalesce(${pagos.pagadoEn}, ${pagos.createdAt}) >= ${inicio}`,
            sql`coalesce(${pagos.pagadoEn}, ${pagos.createdAt}) < ${fin}`,
          ),
        )
        .orderBy(desc(pagos.pagadoEn)),
      db
        .select({
          id: pagos.id,
          negocioId: pagos.negocioId,
          negocio: places.name,
          tipo: pagos.tipo,
          clave: pagos.clave,
          metodo: pagos.metodo,
          montoCentavos: pagos.montoCentavos,
          createdAt: pagos.createdAt,
        })
        .from(pagos)
        .innerJoin(places, eq(places.id, pagos.negocioId))
        .where(eq(pagos.estado, "pendiente"))
        .orderBy(desc(pagos.createdAt))
        .limit(12),
      db
        .select({
          negocioId: suscripciones.negocioId,
          negocio: places.name,
          plan: suscripciones.plan,
          venceEn: suscripciones.venceEn,
          descuentoPct: suscripciones.descuentoPct,
          modulos: suscripciones.modulos,
          whatsapp: places.whatsapp,
          telefonoDueno: sql<string | null>`(
            select u.phone
            from business_owners bo
            inner join users u on u.id = bo.user_id
            where bo.place_id = ${places.id} and bo.role = 'owner'
            limit 1
          )`,
        })
        .from(suscripciones)
        .innerJoin(places, eq(places.id, suscripciones.negocioId))
        .where(
          and(
            eq(suscripciones.estado, "activa"),
            sql`${suscripciones.plan} <> 'gratis'`,
            lt(suscripciones.venceEn, ahora),
          ),
        )
        .orderBy(asc(suscripciones.venceEn))
        .limit(10),
      db
        .select({
          negocioId: suscripciones.negocioId,
          negocio: places.name,
          trialHasta: suscripciones.trialHasta,
        })
        .from(suscripciones)
        .innerJoin(places, eq(places.id, suscripciones.negocioId))
        .where(
          and(
            eq(suscripciones.estado, "activa"),
            eq(suscripciones.plan, "gratis"),
            gt(suscripciones.trialHasta, ahora),
            lte(suscripciones.trialHasta, enSieteDias),
          ),
        )
        .orderBy(asc(suscripciones.trialHasta))
        .limit(10),
      db
        .select({
          negocioId: suscripciones.negocioId,
          plan: suscripciones.plan,
          venceEn: suscripciones.venceEn,
          descuentoPct: suscripciones.descuentoPct,
          modulos: suscripciones.modulos,
        })
        .from(suscripciones)
        .where(eq(suscripciones.estado, "activa")),
      db
        .selectDistinct({ negocioId: businessOwners.placeId })
        .from(businessOwners)
        .innerJoin(users, eq(users.id, businessOwners.userId))
        .where(
          and(
            eq(businessOwners.role, "owner"),
            isNotNull(users.referredBy),
          ),
        ),
    ]);

  const facturadoCentavos = pagosDelMes.reduce(
    (total, pago) => total + pago.montoCentavos,
    0,
  );

  const origenesMap = new Map<string, OrigenDinero>();
  for (const pago of pagosDelMes) {
    const clave = `${pago.tipo}:${pago.clave}`;
    const actual = origenesMap.get(clave);
    if (actual) {
      actual.montoCentavos += pago.montoCentavos;
    } else {
      origenesMap.set(clave, {
        tipo: pago.tipo,
        clave: pago.clave,
        nombre: conceptoDe(pago.tipo, pago.clave, cat),
        montoCentavos: pago.montoCentavos,
        porcentaje: 0,
      });
    }
  }

  const origenes = [...origenesMap.values()]
    .map((origen) => ({
      ...origen,
      porcentaje:
        facturadoCentavos > 0
          ? (origen.montoCentavos / facturadoCentavos) * 100
          : 0,
    }))
    .sort((a, b) => b.montoCentavos - a.montoCentavos);

  let recurrenteCentavos = 0;
  const pagando = new Set<string>();
  const porPlanMap = new Map<Plan | "modulos", PlanPagando>();

  for (const fila of activas as FilaSuscripcion[]) {
    const planVigente =
      fila.plan !== "gratis" &&
      (!fila.venceEn || fila.venceEn.getTime() > ahora.getTime());
    const modulosCentavos = modulosVigentesCentavos(fila.modulos, cat, ahora);

    if (!planVigente && modulosCentavos === 0) continue;

    pagando.add(fila.negocioId);
    const plan = planVigente
      ? planCentavos(fila.plan, fila.descuentoPct, cat)
      : 0;
    const total = plan + modulosCentavos;
    recurrenteCentavos += total;

    const clave: Plan | "modulos" = planVigente ? fila.plan : "modulos";
    const actual = porPlanMap.get(clave);
    if (actual) {
      actual.negocios += 1;
      actual.montoCentavos += total;
    } else {
      porPlanMap.set(clave, {
        clave,
        nombre:
          clave === "modulos"
            ? "Solo módulos"
            : nombreDe(clave, cat),
        negocios: 1,
        montoCentavos: total,
      });
    }
  }

  const porPlan = [...porPlanMap.values()].sort(
    (a, b) =>
      (a.clave === "modulos" ? 99 : PLAN_ORDER.indexOf(a.clave)) -
      (b.clave === "modulos" ? 99 : PLAN_ORDER.indexOf(b.clave)),
  );

  const comisionesCentavos = afiliados.reduce((total, afiliado) => {
    const historial = afiliado.resumen.historialMeses.find(
      (fila) => fila.mes === mes,
    );
    return total + (historial?.comisionUsdCentavos ?? 0);
  }, 0);

  const referidosSet = new Set(referidos.map((fila) => fila.negocioId));
  const pagosReferidosCentavos = pagosDelMes
    .filter(
      (pago) =>
        pago.metodo === "qvapay" && referidosSet.has(pago.negocioId),
    )
    .reduce((total, pago) => total + pago.montoCentavos, 0);

  /* La comisión nunca puede superar el 30 % del primer pago ni ser cero si hubo
     pagos referidos. Si pasa, el aviso manda a Afiliados en vez de esconderlo. */
  const descuadre =
    pagosReferidosCentavos > 0 &&
    (comisionesCentavos === 0 ||
      comisionesCentavos > Math.round(pagosReferidosCentavos * 0.3));

  const cobros: CobroPendiente[] = [];

  for (const vencida of vencidas as FilaVencida[]) {
    if (!vencida.venceEn) continue;
    const plan = nombreDe(vencida.plan, cat);
    const fecha = FECHA_CORTA.format(vencida.venceEn);
    const telefono = normalizarTelefono(
      vencida.whatsapp ?? vencida.telefonoDueno ?? "",
    );
    const mensaje = `Hola ${vencida.negocio}, te escribimos de La Verde. Tu plan ${plan} venció el ${fecha}. ¿Quieres renovarlo?`;
    const whatsapp = enlaceWhatsapp(mensaje, telefono);
    /* Solo el plan: un módulo suelto puede seguir vigente aunque el pack haya
       vencido, y en ese caso no se le está cobrando dos veces. */
    const montoCentavos = planCentavos(
      vencida.plan,
      vencida.descuentoPct,
      cat,
    );

    cobros.push({
      id: `vencido:${vencida.negocioId}`,
      grupo: "vencido",
      negocioId: vencida.negocioId,
      negocio: vencida.negocio,
      detalle: `Venció el ${fecha} · Plan ${plan}`,
      fecha: vencida.venceEn.toISOString(),
      montoCentavos,
      accion: whatsapp
        ? { tipo: "whatsapp", href: whatsapp }
        : {
            tipo: "ofrecer",
            href: `/admin/negocios/${vencida.negocioId}/editar`,
          },
    });
  }

  for (const pago of pagosPendientes) {
    cobros.push({
      id: `pago:${pago.id}`,
      grupo: "por_confirmar",
      negocioId: pago.negocioId,
      negocio: pago.negocio,
      detalle: `${pago.metodo === "qvapay" ? "QvaPay" : pago.metodo === "manual" ? "Factura manual" : "Cortesía"} · ${conceptoDe(pago.tipo, pago.clave, cat)} · ${FECHA_HORA.format(pago.createdAt)}`,
      fecha: pago.createdAt.toISOString(),
      montoCentavos: pago.montoCentavos,
      accion: { tipo: "confirmar", pagoId: pago.id },
    });
  }

  for (const prueba of pruebas as FilaPrueba[]) {
    if (!prueba.trialHasta) continue;
    const dias = Math.max(
      0,
      Math.ceil((prueba.trialHasta.getTime() - ahora.getTime()) / DIA),
    );
    cobros.push({
      id: `prueba:${prueba.negocioId}`,
      grupo: "prueba",
      negocioId: prueba.negocioId,
      negocio: prueba.negocio,
      detalle: `La prueba termina el ${FECHA_CORTA.format(prueba.trialHasta)}${
        dias === 0
          ? " · hoy"
          : dias === 1
            ? " · queda 1 día"
            : ` · quedan ${dias} días`
      }`,
      fecha: prueba.trialHasta.toISOString(),
      montoCentavos: null,
      accion: {
        tipo: "ofrecer",
        href: `/admin/negocios/${prueba.negocioId}/editar`,
      },
    });
  }

  cobros.sort(
    (a, b) =>
      ORDEN_GRUPO[a.grupo] - ORDEN_GRUPO[b.grupo] ||
      a.fecha.localeCompare(b.fecha),
  );

  const netoCentavos = facturadoCentavos - comisionesCentavos;

  return {
    mes,
    facturadoCentavos,
    facturadoCup: cupDe(facturadoCentavos, cat.tasaCup),
    recurrenteCentavos,
    recurrenteCup: cupDe(recurrenteCentavos, cat.tasaCup),
    comisionesCentavos,
    comisionesCup: cupDe(comisionesCentavos, cat.tasaCup),
    netoCentavos,
    netoCup: cupDe(netoCentavos, cat.tasaCup),
    tasaCup: cat.tasaCup,
    tasaFuente: cat.tasaCupFuente,
    tasaActualizadaEn: cat.tasaCupActualizadaEn,
    negociosPagando: pagando.size,
    porPlan,
    origenes,
    cobros,
    afiliados: {
      pagosReferidosCentavos,
      comisionesCentavos,
      descuadre,
    },
  };
}

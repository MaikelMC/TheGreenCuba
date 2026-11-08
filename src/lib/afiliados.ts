import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  afiliadoCobros,
  afiliadoNotas,
  afiliadoPremios,
  businessOwners,
  pagos,
  places,
  suscripciones,
  users,
} from "@/lib/db/schema";

/**
 * Reglas del programa de afiliados (acordadas por Mauricio y Maikel, nov. 2026).
 *
 * Un negocio es de un afiliado cuando su dueño se registró con el enlace del
 * afiliado (`users.referred_by`). Solo cuentan los negocios que **pagaron**: los
 * pagos `pagado` de QvaPay en `pagos`. La comisión no se guarda; se calcula aquí.
 */
export const REGLAS_AFILIADOS = {
  /** Del primer pago del negocio (con «paga 1, llévate 2» ese pago cubre 2 meses). */
  primerPago: 0.3,
  /** De cada pago siguiente, durante `mesesRecurrente` desde el primero. */
  recurrente: 0.1,
  /** El recurrente sube a esto con `negociosParaSubir` o más negocios pagando a la vez. */
  recurrenteAlto: 0.12,
  negociosParaSubir: 10,
  mesesRecurrente: 12,
  /** Días que una comisión queda «pendiente» antes de poder cobrarse. */
  diasRetencion: 7,
  /** Mínimo para pedir un cobro, en CUP. */
  cobroMinimoCup: 500,
  /** Metas del mes: negocios **nuevos** que hicieron su primer pago ese mes. */
  metaBono: 10,
  metaRecarga: 25,
  /** Negocios pagados en todo el programa para contar con él en el equipo de marketing. */
  metaEquipo: 50,
  /** Días antes del vencimiento en que el negocio sale como «vence pronto». */
  diasAvisoVence: 3,
} as const;

/** CUP por USD con que se pasan las comisiones a CUP. Se cambia en la variable de entorno. */
export function tasaUsdCup(): number {
  const n = Number(process.env.AFILIADOS_TASA_USD_CUP);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 400;
}

export const METODOS_COBRO = {
  saldo: "Saldo móvil",
  transferencia_cup: "Transferencia en CUP",
  cubapay: "QvaPay",
} as const;
export type MetodoCobro = keyof typeof METODOS_COBRO;

export type EstadoNegocio = "registrado" | "activo" | "vence" | "baja";

export interface NegocioAfiliado {
  id: string;
  nombre: string;
  plan: string | null;
  estado: EstadoNegocio;
  venceEn: Date | null;
  primerPago: Date | null;
  pagos: number;
  /** Centavos de USD que este negocio le ha generado al afiliado. */
  comisionUsdCentavos: number;
  /** Centavos de USD que le tocan por cada pago mensual a partir de ahora (0 si ya no). */
  porMesUsdCentavos: number;
}

export interface ResumenAfiliado {
  negocios: NegocioAfiliado[];
  personasRegistradas: number;
  pagando: number;
  porcentajeRecurrente: number;
  nuevosEsteMes: number;
  totalPagados: number;
  ultimoNegocio: Date | null;
  /** Todo en centavos de USD; la página lo enseña en CUP con `aCup`. */
  dinero: { generado: number; pendiente: number; disponible: number; pedido: number; cobrado: number };
  cobros: (typeof afiliadoCobros.$inferSelect)[];
  premiosGanados: { tipo: "bono" | "recarga_internacional"; mes: string; entregado: boolean }[];
  /** Historial mes a mes, ordenado del más reciente al más antiguo. */
  historialMeses: { mes: string; comisionUsdCentavos: number; nuevosNegocios: number }[];
}

const DIA = 86_400_000;

export function mesActual(fecha = new Date()): string {
  return fecha.toISOString().slice(0, 7);
}

/** Centavos de USD → CUP enteros con la tasa dada. */
export function aCup(usdCentavos: number, tasa = tasaUsdCup()): number {
  return Math.round((usdCentavos / 100) * tasa);
}

export function formatoCup(cup: number): string {
  return `${new Intl.NumberFormat("es-CU", { maximumFractionDigits: 0 }).format(cup)} CUP`;
}

export async function resumenAfiliado(afiliadoId: string): Promise<ResumenAfiliado> {
  const ahora = Date.now();
  const R = REGLAS_AFILIADOS;

  const [filas, personas, cobros, entregados] = await Promise.all([
    db
      .select({
        id: places.id,
        nombre: places.name,
        plan: suscripciones.plan,
        estadoSuscripcion: suscripciones.estado,
        venceEn: suscripciones.venceEn,
      })
      .from(users)
      .innerJoin(businessOwners, and(eq(businessOwners.userId, users.id), eq(businessOwners.role, "owner")))
      .innerJoin(places, eq(places.id, businessOwners.placeId))
      .leftJoin(suscripciones, eq(suscripciones.negocioId, places.id))
      .where(eq(users.referredBy, afiliadoId)),
    db.select({ id: users.id }).from(users).where(eq(users.referredBy, afiliadoId)),
    db.select().from(afiliadoCobros).where(eq(afiliadoCobros.afiliadoId, afiliadoId)).orderBy(desc(afiliadoCobros.createdAt)),
    db.select().from(afiliadoPremios).where(eq(afiliadoPremios.afiliadoId, afiliadoId)),
  ]);

  const ids = filas.map((f) => f.id);
  const pagados = ids.length
    ? await db
        .select({ negocioId: pagos.negocioId, monto: pagos.montoCentavos, pagadoEn: pagos.pagadoEn, createdAt: pagos.createdAt })
        .from(pagos)
        .where(and(inArray(pagos.negocioId, ids), eq(pagos.estado, "pagado"), eq(pagos.metodo, "qvapay")))
        .orderBy(asc(pagos.pagadoEn))
    : [];

  const porNegocio = new Map<string, { monto: number; fecha: Date }[]>();
  for (const p of pagados) {
    const lista = porNegocio.get(p.negocioId) ?? [];
    lista.push({ monto: p.monto, fecha: p.pagadoEn ?? p.createdAt });
    porNegocio.set(p.negocioId, lista);
  }

  // Primero el estado de cada negocio, porque el porcentaje recurrente depende de cuántos pagan a la vez.
  const base = filas.map((f) => {
    const lista = porNegocio.get(f.id) ?? [];
    const vence = f.venceEn ? f.venceEn.getTime() : null;
    const vigente = lista.length > 0 && f.estadoSuscripcion === "activa" && vence !== null && vence > ahora;
    const estado: EstadoNegocio = !lista.length
      ? "registrado"
      : !vigente
        ? "baja"
        : vence! - ahora < R.diasAvisoVence * DIA
          ? "vence"
          : "activo";
    return { f, lista, estado };
  });
  const pagando = base.filter((b) => b.estado === "activo" || b.estado === "vence").length;
  const pct = pagando >= R.negociosParaSubir ? R.recurrenteAlto : R.recurrente;

  let generado = 0;
  let pendiente = 0;
  const mes = mesActual();
  let nuevosEsteMes = 0;
  let ultimo: Date | null = null;
  const mesesMap = new Map<string, { comision: number; nuevos: number }>();

  const negocios: NegocioAfiliado[] = base.map(({ f, lista, estado }) => {
    const primero = lista[0]?.fecha ?? null;
    const limite = primero ? primero.getTime() + R.mesesRecurrente * 30 * DIA : 0;
    let comision = 0;
    lista.forEach((p, i) => {
      const c = i === 0 ? Math.round(p.monto * R.primerPago) : p.fecha.getTime() <= limite ? Math.round(p.monto * pct) : 0;
      comision += c;
      if (ahora - p.fecha.getTime() < R.diasRetencion * DIA) pendiente += c;
      if (!ultimo || p.fecha > ultimo) ultimo = p.fecha;
      const mr = mesesMap.get(p.fecha.toISOString().slice(0, 7)) ?? { comision: 0, nuevos: 0 };
      mr.comision += c;
      if (i === 0) mr.nuevos += 1;
      mesesMap.set(p.fecha.toISOString().slice(0, 7), mr);
    });
    generado += comision;
    if (primero && mesActual(primero) === mes) nuevosEsteMes++;
    const ultimoMonto = lista.at(-1)?.monto ?? 0;
    const sigue = (estado === "activo" || estado === "vence") && ahora <= limite;
    return {
      id: f.id,
      nombre: f.nombre,
      plan: f.plan,
      estado,
      venceEn: f.venceEn,
      primerPago: primero,
      pagos: lista.length,
      comisionUsdCentavos: comision,
      porMesUsdCentavos: sigue ? Math.round(ultimoMonto * pct) : 0,
    };
  });

  const pedido = cobros.filter((c) => c.estado === "pedido").reduce((s, c) => s + c.montoUsdCentavos, 0);
  const cobrado = cobros.filter((c) => c.estado === "pagado").reduce((s, c) => s + c.montoUsdCentavos, 0);
  const disponible = Math.max(0, generado - pendiente - pedido - cobrado);

  const premiosGanados: ResumenAfiliado["premiosGanados"] = [];
  const entregado = (tipo: string) => entregados.some((p) => p.mes === mes && p.tipo === tipo);
  if (nuevosEsteMes >= R.metaBono) premiosGanados.push({ tipo: "bono", mes, entregado: entregado("bono") });
  if (nuevosEsteMes >= R.metaRecarga)
    premiosGanados.push({ tipo: "recarga_internacional", mes, entregado: entregado("recarga_internacional") });

  const orden: Record<EstadoNegocio, number> = { vence: 0, registrado: 1, activo: 2, baja: 3 };
  negocios.sort((a, b) => orden[a.estado] - orden[b.estado] || a.nombre.localeCompare(b.nombre));

  const historialMeses = Array.from(mesesMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([m, v]) => ({ mes: m, comisionUsdCentavos: v.comision, nuevosNegocios: v.nuevos }));

  return {
    negocios,
    personasRegistradas: personas.length,
    pagando,
    porcentajeRecurrente: pct,
    nuevosEsteMes,
    totalPagados: negocios.filter((n) => n.pagos > 0).length,
    ultimoNegocio: ultimo,
    dinero: { generado, pendiente, disponible, pedido, cobrado },
    cobros,
    premiosGanados,
    historialMeses,
  };
}

/** Todos los afiliados (los que tienen código) con su resumen, para la administración. */
export async function listarAfiliados() {
  const afiliados = await db
    .select({ id: users.id, nombre: users.name, email: users.email, phone: users.phone, ciudad: users.locationCity, codigo: users.referralCode, creado: users.createdAt })
    .from(users)
    .where(isNotNull(users.referralCode))
    .orderBy(asc(users.createdAt));
  return Promise.all(afiliados.map(async (a) => ({ ...a, resumen: await resumenAfiliado(a.id) })));
}

export async function notasAfiliado(afiliadoId: string) {
  return db
    .select({ id: afiliadoNotas.id, texto: afiliadoNotas.texto, createdAt: afiliadoNotas.createdAt, autor: users.name })
    .from(afiliadoNotas)
    .leftJoin(users, eq(users.id, afiliadoNotas.autorId))
    .where(eq(afiliadoNotas.afiliadoId, afiliadoId))
    .orderBy(desc(afiliadoNotas.createdAt));
}

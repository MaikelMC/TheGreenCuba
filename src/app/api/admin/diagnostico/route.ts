import { NextRequest, NextResponse } from "next/server";
import { gte, sql } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { diagnosticos } from "@/lib/db/schema";
import {
  agruparErrores,
  contarErroresAltos,
  limpiarRuta,
} from "@/lib/diagnostico/errores";
import {
  ETIQUETA_PLATAFORMA,
  normalizarPlataforma,
  type Plataforma,
} from "@/lib/diagnostico/plataforma";
import {
  evaluarResumen,
  type AvisoResumen,
} from "@/lib/diagnostico/resumen";

export const dynamic = "force-dynamic";

const DIA = 24 * 60 * 60 * 1000;

type Fila = typeof diagnosticos.$inferSelect;

function esBot(fila: Fila): boolean {
  const datos = fila.datos;
  return datos.bot === true || datos.plataforma === "bot";
}

function dato(fila: Fila, clave: string): unknown {
  return fila.datos[clave];
}

function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function contarPor<T extends string>(
  filas: Fila[],
  obtener: (fila: Fila) => T | null,
): Map<T, number> {
  const mapa = new Map<T, number>();
  for (const fila of filas) {
    const clave = obtener(fila);
    if (clave) mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
  }
  return mapa;
}

function top<T extends string>(
  mapa: Map<T, number>,
  limite = 5,
): { clave: T; total: number }[] {
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([clave, total]) => ({ clave, total }));
}

function metricas(filas: Fila[], desde: number, hasta: number) {
  const actuales = filas.filter((fila) => {
    const t = fila.creadoEn.getTime();
    return t >= desde && t < hasta;
  });
  const navegadores = actuales.filter(
    (fila) => fila.tipo === "navegador" && !esBot(fila),
  );
  const total = navegadores.length;

  const plataformas: Record<Plataforma, number> = {
    android: 0,
    ios: 0,
    escritorio: 0,
    otros: 0,
  };
  for (const fila of navegadores) {
    plataformas[normalizarPlataforma(dato(fila, "plataforma"))] += 1;
  }

  const porTipo = (tipo: string) =>
    actuales.filter((fila) => fila.tipo === tipo && !esBot(fila));
  const cargados = porTipo("mapa_cargado");
  const lentos = porTipo("mapa_lento");
  const erroresMapa = porTipo("mapa_error");
  const abandonados = porTipo("mapa_abandonado");
  const inicios = porTipo("mapa_inicio");
  const erroresFatales = erroresMapa.filter(
    (fila) => dato(fila, "parcial") !== true,
  );
  const totalCargas =
    cargados.length + erroresFatales.length + abandonados.length;
  const tasaExito =
    totalCargas > 0
      ? Math.round((cargados.length / totalCargas) * 1000) / 10
      : null;
  const tiempos = cargados
    .map((fila) => numero(dato(fila, "msDesdeMontaje")))
    .filter((valor): valor is number => valor !== null && valor >= 0);
  const tiempoMedioMs =
    tiempos.length > 0
      ? Math.round(tiempos.reduce((suma, valor) => suma + valor, 0) / tiempos.length)
      : null;

  const android = navegadores.filter(
    (fila) => normalizarPlataforma(dato(fila, "plataforma")) === "android",
  );
  const sinWebgl = android.filter((fila) => dato(fila, "webgl1") === false).length;
  const webglPorSoftware = android.filter(
    (fila) => dato(fila, "webglSoftware") === true,
  ).length;

  const chrome = contarPor(navegadores, (fila) => {
    const familia = dato(fila, "navegador");
    const familiaAntigua = dato(fila, "chromeVersion");
    if (familia && familia !== "Chrome") return null;
    const version = dato(fila, "navegadorVersion") ?? familiaAntigua;
    if (typeof version === "number") return String(version);
    return typeof version === "string" && version ? version : null;
  });
  const chromeTotal = [...chrome.values()].reduce((a, b) => a + b, 0);

  const swVersiones = contarPor(navegadores, (fila) => {
    const version = dato(fila, "swVersion");
    return typeof version === "string" && version ? version : null;
  });
  const publicadas = contarPor(navegadores, (fila) => {
    const version = dato(fila, "swPublicada");
    return typeof version === "string" && version ? version : null;
  });
  const swPublicada = top(publicadas, 1)[0]?.clave ?? null;
  const swRegistrado = [...swVersiones.values()].reduce((a, b) => a + b, 0);
  const swActual = swPublicada ? (swVersiones.get(swPublicada) ?? 0) : 0;

  const errores = agruparErrores(
    actuales.filter((fila) => fila.tipo === "error" && !esBot(fila)),
  );
  const erroresAltos = contarErroresAltos(errores) + erroresMapa.length;

  return {
    total,
    plataformas,
    mapa: {
      tasaExito,
      tiempoMedioMs,
      total: totalCargas,
      inicios: inicios.length,
      cargados: cargados.length,
      lentos: lentos.length,
      errores: erroresMapa.length,
      abandonados: abandonados.length,
    },
    sinWebgl,
    webglPorSoftware,
    android: android.length,
    topVersionesChrome: top(chrome).map(({ clave, total: casos }) => ({
      version: clave,
      total: casos,
      pct: chromeTotal > 0 ? Math.round((casos / chromeTotal) * 1000) / 10 : 0,
    })),
    topVersionesSw: top(swVersiones).map(({ clave, total: casos }) => ({
      version: clave,
      total: casos,
      pct: swRegistrado > 0 ? Math.round((casos / swRegistrado) * 1000) / 10 : 0,
    })),
    swPublicada,
    swRegistrado,
    swDesactualizado: Math.max(0, swRegistrado - swActual),
    errores,
    erroresAltos,
    cargasLentasOError: lentos.length + erroresMapa.length,
    sinClasificar: plataformas.otros,
  };
}

function delta(actual: number, anterior: number): number {
  return actual - anterior;
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const ahora = Date.now();
  const corteActual = ahora - 7 * DIA;
  const corteAnterior = ahora - 14 * DIA;

  try {
    const filas = await db
      .select()
      .from(diagnosticos)
      .where(gte(diagnosticos.creadoEn, new Date(corteAnterior)))
      .orderBy(sql`${diagnosticos.creadoEn} desc`);

    const actual = metricas(filas, corteActual, ahora + 1);
    const anterior = metricas(filas, corteAnterior, corteActual);
    const resumen: AvisoResumen[] = evaluarResumen({
      sesiones: actual.total,
      cargasMapa: actual.mapa.total,
      android: actual.android,
      androidSinWebgl: actual.sinWebgl,
      erroresAltos: actual.erroresAltos,
      cargasLentasOError: actual.cargasLentasOError,
      swRegistrado: actual.swRegistrado,
      swDesactualizado: actual.swDesactualizado,
      sinClasificar: actual.sinClasificar,
    });

    return NextResponse.json(
      {
        ok: true,
        periodo: "7 días",
        actualizadoEn: new Date(ahora).toISOString(),
        total: actual.total,
        plataformas: actual.plataformas,
        etiquetasPlataforma: ETIQUETA_PLATAFORMA,
        mapa: actual.mapa,
        sinWebgl: actual.sinWebgl,
        webglPorSoftware: actual.webglPorSoftware,
        android: actual.android,
        topVersionesChrome: actual.topVersionesChrome,
        topVersionesSw: actual.topVersionesSw,
        swPublicada: actual.swPublicada,
        swRegistrado: actual.swRegistrado,
        swDesactualizado: actual.swDesactualizado,
        errores: actual.errores.map((grupo) => ({
          ...grupo,
          rutas: grupo.rutas.map(limpiarRuta),
        })),
        resumen,
        comparacion: {
          total: delta(actual.total, anterior.total),
          cargasMapa: delta(actual.mapa.total, anterior.mapa.total),
          erroresMapa: delta(actual.mapa.errores, anterior.mapa.errores),
          sinWebgl: delta(actual.sinWebgl, anterior.sinWebgl),
          erroresAltos: delta(actual.erroresAltos, anterior.erroresAltos),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[api/admin/diagnostico]",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "No se pudieron cargar los diagnósticos." },
      { status: 500 },
    );
  }
}

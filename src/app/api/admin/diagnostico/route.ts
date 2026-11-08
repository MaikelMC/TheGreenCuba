import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { diagnosticos } from "@/lib/db/schema";
import { gte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Resumen de diagnósticos de los últimos 7 días para /admin/diagnostico.
 *
 * Consultas separadas por tipo: más legible que un GROUP BY multidimensional
 * y la tabla es pequeña (retención 30 días, escrituras ligeras).
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const corte = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const filas = await db
      .select()
      .from(diagnosticos)
      .where(gte(diagnosticos.creadoEn, corte))
      .orderBy(sql`${diagnosticos.creadoEn} desc`);

    /* Agrega en memoria: la tabla es pequeña y esto evita 6 consultas SQL. */
    const porTipo = new Map<string, typeof filas>();
    for (const f of filas) {
      const lista = porTipo.get(f.tipo) ?? [];
      lista.push(f);
      porTipo.set(f.tipo, lista);
    }

    const navegadores = porTipo.get("navegador") ?? [];
    const errores = porTipo.get("error") ?? [];
    const mapasCargados = porTipo.get("mapa_cargado") ?? [];
    const mapaLento = porTipo.get("mapa_lento") ?? [];
    const mapaError = porTipo.get("mapa_error") ?? [];
    const mapaAbandonado = porTipo.get("mapa_abandonado") ?? [];

    /* Plataformas desde el campo datos.plataforma de los eventos navegador. */
    const porPlataforma = { android: 0, ios: 0, escritorio: 0, otro: 0 };
    for (const f of navegadores) {
      const p = (f.datos as Record<string, unknown>).plataforma as string;
      if (p === "android") porPlataforma.android++;
      else if (p === "ios") porPlataforma.ios++;
      else if (p === "escritorio") porPlataforma.escritorio++;
      else porPlataforma.otro++;
    }

    /* Éxito del mapa: sesiones que enviaron mapa_cargado / total con evento de mapa. */
    const totalConMapa =
      mapasCargados.length + mapaLento.length + mapaError.length + mapaAbandonado.length;
    const tasaExito =
      totalConMapa > 0
        ? Math.round((mapasCargados.length / totalConMapa) * 100)
        : null;

    /* Tiempo medio de carga (desde montaje del componente). */
    const tiemposMontaje = mapasCargados
      .map((f) => (f.datos as Record<string, unknown>).msDesdeMontaje as number)
      .filter((n) => typeof n === "number" && n > 0);
    const tiempoMedioMs =
      tiemposMontaje.length > 0
        ? Math.round(tiemposMontaje.reduce((a, b) => a + b, 0) / tiemposMontaje.length)
        : null;

    /* Versiones de Chrome más comunes. */
    const chromeVersiones = new Map<string, number>();
    for (const f of navegadores) {
      const v = (f.datos as Record<string, unknown>).chromeVersion as string | undefined;
      if (v) chromeVersiones.set(v, (chromeVersiones.get(v) ?? 0) + 1);
    }
    const topVersiones = [...chromeVersiones.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([version, total]) => ({ version, total }));

    /* WebGL: sin WebGL o por software. */
    const sinWebgl = navegadores.filter(
      (f) => !(f.datos as Record<string, unknown>).webgl1,
    ).length;
    const webglPorSoftware = navegadores.filter(
      (f) => (f.datos as Record<string, unknown>).webglSoftware,
    ).length;

    /* Errores más repetidos. */
    const mensajesError = new Map<string, number>();
    for (const f of errores) {
      const m = (f.datos as Record<string, unknown>).mensaje as string | undefined;
      if (m) mensajesError.set(m, (mensajesError.get(m) ?? 0) + 1);
    }
    const topErrores = [...mensajesError.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mensaje, total]) => ({ mensaje, total }));

    /* Versiones del SW activas. */
    const swVersiones = new Map<string, number>();
    for (const f of navegadores) {
      const v = (f.datos as Record<string, unknown>).swVersion as string | undefined;
      if (v) swVersiones.set(v, (swVersiones.get(v) ?? 0) + 1);
    }
    const topSw = [...swVersiones.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([version, total]) => ({ version, total }));

    return NextResponse.json({
      ok: true,
      periodo: "7 días",
      total: filas.length,
      plataformas: porPlataforma,
      mapa: {
        tasaExito,
        tiempoMedioMs,
        total: totalConMapa,
        cargados: mapasCargados.length,
        lentos: mapaLento.length,
        errores: mapaError.length,
        abandonados: mapaAbandonado.length,
      },
      sinWebgl,
      webglPorSoftware,
      topVersionesChrome: topVersiones,
      topErrores,
      topVersionesSw: topSw,
    });
  } catch (err) {
    console.error(
      "[api/admin/diagnostico]",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { ok: false, error: "No se pudieron cargar los diagnósticos." },
      { status: 500 },
    );
  }
}

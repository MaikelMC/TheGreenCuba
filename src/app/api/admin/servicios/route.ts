import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { getActiveProviders } from "@/lib/ai/providers-store";
import { db } from "@/lib/db";
import { emailConfigured } from "@/lib/email";
import { s3ConfigProblem } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

type EstadoServicio = "ok" | "revisar" | "caido";

interface Servicio {
  id: string;
  nombre: string;
  detalle: string;
  estado: EstadoServicio;
  latenciaMs: number | null;
}

const CACHE_MS = 5 * 60 * 1000;
let cache: { expira: number; datos: Servicio[] } | null = null;

async function conTimeout<T>(tarea: Promise<T>, ms: number): Promise<T> {
  tarea.catch(() => {});
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  const limite = new Promise<never>((_, reject) => {
    temporizador = setTimeout(() => reject(new Error("Tiempo de espera")), ms);
  });
  try {
    return await Promise.race([tarea, limite]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

async function medir(
  fn: () => Promise<{ estado: EstadoServicio; detalle: string }>,
): Promise<Servicio> {
  const inicio = Date.now();
  try {
    const resultado = await conTimeout(fn(), 3500);
    return {
      ...resultado,
      latenciaMs: Date.now() - inicio,
    } as Servicio;
  } catch (error) {
    return {
      id: "",
      nombre: "",
      detalle: error instanceof Error ? error.message : "Sin respuesta",
      estado: "caido",
      latenciaMs: Date.now() - inicio,
    };
  }
}

async function comprobar(): Promise<Servicio[]> {
  const servicios: Servicio[] = [];

  const dbServicio = await medir(async () => {
    await db.execute(sql`select 1`);
    return { estado: "ok", detalle: "Consulta de prueba correcta" };
  });
  servicios.push({ ...dbServicio, id: "base-datos", nombre: "Base de datos" });

  const authServicio = await medir(async () => {
    const resultado = await db.execute(
      sql`select count(*)::int as total from neon_auth.user`,
    );
    const total = (resultado.rows[0] as { total?: number } | undefined)?.total ?? 0;
    return {
      estado: "ok",
      detalle: `${total} ${total === 1 ? "cuenta" : "cuentas"} de acceso`,
    };
  });
  servicios.push({ ...authServicio, id: "autenticacion", nombre: "Autenticación" });

  const telegramConfigurado = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const telegramServicio = await medir(async () => {
    if (!telegramConfigurado) {
      return { estado: "revisar", detalle: "Falta TELEGRAM_BOT_TOKEN" };
    }
    const resultado = await db.execute(
      sql`select count(*)::int as pendientes from asistente_log where pendiente = true`,
    );
    const pendientes =
      (resultado.rows[0] as { pendientes?: number } | undefined)?.pendientes ?? 0;
    return {
      estado: pendientes > 20 ? "revisar" : "ok",
      detalle: `${pendientes} ${pendientes === 1 ? "consulta pendiente" : "consultas pendientes"} · sin registro de último error`,
    };
  });
  servicios.push({ ...telegramServicio, id: "telegram", nombre: "Telegram" });

  const storageProblema = s3ConfigProblem();
  servicios.push({
    id: "archivos",
    nombre: "Subida de archivos",
    detalle: storageProblema ?? "Configuración S3 completa",
    estado: storageProblema ? "revisar" : "ok",
    latenciaMs: null,
  });

  servicios.push({
    id: "correo",
    nombre: "Correo",
    detalle: emailConfigured() ? "SMTP configurado" : "Faltan variables SMTP",
    estado: emailConfigured() ? "ok" : "revisar",
    latenciaMs: null,
  });

  const qvapay = Boolean(
    process.env.QVAPAY_APP_ID?.trim() && process.env.QVAPAY_APP_SECRET?.trim(),
  );
  servicios.push({
    id: "qvapay",
    nombre: "QvaPay",
    detalle: qvapay ? "Credenciales presentes" : "Faltan QVAPAY_APP_ID o QVAPAY_APP_SECRET",
    estado: qvapay ? "ok" : "revisar",
    latenciaMs: null,
  });

  const proveedores = getActiveProviders();
  servicios.push({
    id: "ia",
    nombre: "Proveedores de IA",
    detalle:
      proveedores.length > 0
        ? `${proveedores.map((p) => p.name).join(", ")}`
        : "Ningún proveedor activo",
    estado: proveedores.length > 0 ? "ok" : "revisar",
    latenciaMs: null,
  });

  const posthog = Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_KEY ||
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
  );
  servicios.push({
    id: "posthog",
    nombre: "PostHog",
    detalle: posthog ? "Clave pública presente" : "Sin clave de PostHog",
    estado: posthog ? "ok" : "revisar",
    latenciaMs: null,
  });

  return servicios;
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  try {
    const ahora = Date.now();
    if (cache && cache.expira > ahora) {
      return NextResponse.json(
        { ok: true, servicios: cache.datos, cacheado: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const datos = await comprobar();
    cache = { expira: ahora + CACHE_MS, datos };
    return NextResponse.json(
      { ok: true, servicios: datos, cacheado: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[api/admin/servicios]",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "No se pudieron comprobar los servicios." },
      { status: 500 },
    );
  }
}

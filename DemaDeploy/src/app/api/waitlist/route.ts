import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { notificarTodo } from "@/lib/notify";

// Almacenamiento de la waitlist.
// - En Vercel: si existe VERCEL_BLOB_READ_WRITE_TOKEN, se usa Blob (free tier).
// - Fallback local (dev): un archivo JSON dentro de .next para persistir entre reinicios.
// Este archivo NO es la fuente de verdad de producción definitiva; buscá robustez.

type Tipo = "usuario" | "negocio";

interface Registro {
  nombre: string;
  telefono: string;
  tipo: Tipo;
  source: string;
  ts: number;
}

const TELEFONO_RE = /^\+?[0-9][0-9\s().-]{6,17}$/;
const TIPOS: Tipo[] = ["usuario", "negocio"];
const DB_PATH = join(process.cwd(), ".next", "waitlist.json");

async function readLocal(): Promise<Registro[]> {
  try {
    const raw = await readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Registro[];
  } catch {
    // archivo aún no existe o corrupto
  }
  return [];
}

async function writeLocal(regs: Registro[]): Promise<void> {
  await writeFile(DB_PATH, JSON.stringify(regs, null, 2), "utf8");
}

export async function POST(req: NextRequest) {
  let body: {
    nombre?: string;
    telefono?: string;
    tipo?: string;
    source?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const nombre = (body.nombre || "").trim();
  const telefono = (body.telefono || "").trim();
  const tipo = (body.tipo || "usuario") as Tipo;
  const source = (body.source || "preview").trim();

  if (nombre.length < 2 || !TELEFONO_RE.test(telefono) || !TIPOS.includes(tipo)) {
    return NextResponse.json(
      { ok: false, error: "DATOS_INVALIDOS" },
      { status: 400 }
    );
  }

  const registro: Registro = { nombre, telefono, tipo, source, ts: Date.now() };

  // Modo Blob (Vercel free) — mejor esfuerzo, extra de persistencia
  if (process.env.VERCEL_BLOB_READ_WRITE_TOKEN && !process.env.VERCEL) {
    try {
      const res = await fetch("https://api.vercel.com/v1/blob/store", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_BLOB_READ_WRITE_TOKEN}`
        },
        body: JSON.stringify({
          key: "waitlist",
          contentType: "application/json",
          addRandomSuffix: false,
          allowOverwrite: true,
          data: JSON.stringify(registro)
        })
      });
    } catch {
      // sigue con el contador local
    }
  }

  // Contador local + dedupe por teléfono
  const regs = await readLocal();
  const duplicado = regs.some((r) => r.telefono === telefono);
  if (!duplicado) {
    regs.push(registro);
    await writeLocal(regs).catch(() => undefined);
  }

  // Solo notificar cupos realmente nuevos (Telegram + Google Sheets, en paralelo)
  if (!duplicado) {
    await notificarTodo(registro).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, position: regs.length });
}

export async function GET() {
  const regs = await readLocal().catch(() => []);
  const total = regs.length;
  const usuarios = regs.filter((r) => r.tipo === "usuario").length;
  const negocios = regs.filter((r) => r.tipo === "negocio").length;
  return NextResponse.json({ ok: true, position: total, total, usuarios, negocios });
}
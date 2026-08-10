import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

// Almacenamiento de la waitlist.
// - En Vercel: si existe VERCEL_BLOB_READ_WRITE_TOKEN, se usa Blob (free tier).
// - Fallback local (dev): un archivo JSON dentro de .next para persistir entre reinicios.
// Este archivo NO es la fuente de verdad de producción definitiva; buscá robustez.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DB_PATH = join(process.cwd(), ".next", "waitlist.json");

async function readLocal(): Promise<string[]> {
  try {
    const raw = await readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocal(emails: string[]): Promise<void> {
  await writeFile(DB_PATH, JSON.stringify(emails, null, 2), "utf8");
}

export async function POST(req: NextRequest) {
  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const source = (body.source || "preview").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "EMAIL_INVALIDO" },
      { status: 400 }
    );
  }

  // Modo Blob (Vercel free)
  if (process.env.VERCEL_BLOB_READ_WRITE_TOKEN && !process.env.VERCEL) {
    const BLOB_TOKEN = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    try {
      const storeUrl = "https://api.vercel.com/v1/blob/store";
      const res = await fetch(storeUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
        body: JSON.stringify({
          key: "waitlist",
          contentType: "application/json",
          addRandomSuffix: false,
          allowOverwrite: true,
          data: JSON.stringify({ email, source, ts: Date.now() })
        })
      });
      if (!res.ok) throw new Error("blob");
      const data = await res.json();
      return NextResponse.json({
        ok: true,
        position: data?.count ? Number(data.count) : null
      });
    } catch {
      // sigue al fallback local
    }
  }

  // Fallback local (dev)
  const emails = await readLocal();
  if (!emails.includes(email)) {
    emails.push(email);
    await writeLocal(emails).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, position: emails.length });
}

export async function GET() {
  const emails = await readLocal().catch(() => []);
  const count = typeof process.env.VERCEL === "undefined" ? emails.length : null;
  return NextResponse.json({ ok: true, position: count ?? null });
}
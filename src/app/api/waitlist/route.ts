import { NextRequest, NextResponse } from "next/server";
import {
  makeWaitlistId,
  readWaitlist,
  writeWaitlist,
  type WaitlistEntry,
} from "@/lib/waitlist-store";
import { rateLimit } from "@/lib/rate-limit";

// Límite de solicitudes por IP para reducir spam en los datos de contacto.
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function tooMany(retryAfterSeconds?: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Demasiadas solicitudes. Intenta más tarde." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds ?? 3600) },
    },
  );
}

function cleanString(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, 500) : "";
}

function cleanStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.ok) return tooMany(limited.retryAfterSeconds);

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const businessName = cleanString(body.businessName);
    const contactName = cleanString(body.contactName);
    const phone = cleanString(body.phone);

    if (!businessName) {
      return NextResponse.json(
        { ok: false, error: "Escribe el nombre del negocio." },
        { status: 400 },
      );
    }
    if (!contactName) {
      return NextResponse.json(
        { ok: false, error: "Escribe tu nombre." },
        { status: 400 },
      );
    }
    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Escribe un telefono o WhatsApp de contacto." },
        { status: 400 },
      );
    }

    const offerText = cleanString(body.offerText);
    const entry: WaitlistEntry = {
      id: makeWaitlistId(),
      businessName,
      category: cleanString(body.category),
      city: cleanString(body.city),
      address: cleanString(body.address),
      schedule: cleanString(body.schedule),
      days: cleanStringArray(body.days),
      payments: cleanStringArray(body.payments),
      description: cleanString(body.description),
      offer: offerText
        ? { text: offerText, expiry: cleanString(body.offerExpiry) }
        : null,
      contactName,
      phone,
      email: cleanString(body.email),
      notes: cleanString(body.notes),
      status: "nuevo",
      createdAt: Date.now(),
    };

    writeWaitlist([entry, ...readWaitlist()]);
    return NextResponse.json({ ok: true, id: entry.id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar la solicitud." },
      { status: 500 },
    );
  }
}

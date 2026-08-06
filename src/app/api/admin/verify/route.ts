import { NextRequest, NextResponse } from "next/server";
import { isValidAdminKey } from "@/lib/admin-server";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { key?: string };
    if (isValidAdminKey(body.key ?? "")) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { ok: false, error: "Clave incorrecta" },
      { status: 401 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error interno" },
      { status: 500 },
    );
  }
}

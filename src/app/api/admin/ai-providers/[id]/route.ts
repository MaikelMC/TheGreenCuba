import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import {
  maskKey,
  readProviders,
  writeProviders,
  type AiProvider,
} from "@/lib/ai/providers-store";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = (await req.json()) as Partial<AiProvider>;
    const providers = readProviders();
    const existing = providers.find((p) => p.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
    }
    const updated: AiProvider = {
      ...existing,
      ...body,
      id,
      name: body.name?.trim() || existing.name,
      type: body.type === "custom" ? "custom" : "openai",
      vendor:
        body.vendor === "gemini"
          ? "gemini"
          : body.vendor === "openai"
            ? "openai"
            : existing.vendor,
      model: body.model?.trim() || existing.model,
      baseURL:
        typeof body.baseURL === "string"
          ? body.baseURL.trim() || undefined
          : existing.baseURL,
      apiKey: body.apiKey?.trim() || existing.apiKey,
      enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
      priority:
        typeof body.priority === "number" && body.priority > 0
          ? body.priority
          : existing.priority,
    };
    writeProviders(
      providers.map((p) => (p.id === id ? updated : p)),
    );
    return NextResponse.json({
      ...updated,
      apiKey: maskKey(updated.apiKey),
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const providers = readProviders();
  const next = providers.filter((p) => p.id !== id);
  if (next.length === providers.length) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }
  writeProviders(next);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import {
  maskKey,
  readProviders,
  writeProviders,
  type AiProvider,
} from "@/lib/ai/providers-store";

function makeId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const providers = readProviders().map((p) => ({
    ...p,
    apiKey: maskKey(p.apiKey),
  }));
  return NextResponse.json(providers);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as Partial<AiProvider>;
    if (!body.name?.trim() || !body.apiKey?.trim() || !body.model?.trim()) {
      return NextResponse.json(
        { error: "name, apiKey y model son obligatorios" },
        { status: 400 },
      );
    }
    const providers = readProviders();
    const provider: AiProvider = {
      id: makeId(),
      name: body.name.trim(),
      type: body.type === "custom" ? "custom" : "openai",
      vendor: body.vendor === "gemini" ? "gemini" : "openai",
      baseURL: body.baseURL?.trim() || undefined,
      apiKey: body.apiKey.trim(),
      model: body.model.trim(),
      enabled: body.enabled ?? true,
      priority:
        typeof body.priority === "number" && body.priority > 0
          ? body.priority
          : providers.length + 1,
    };
    writeProviders([...providers, provider]);
    return NextResponse.json(
      { ...provider, apiKey: maskKey(provider.apiKey) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

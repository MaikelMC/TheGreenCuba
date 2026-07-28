import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body as { messages: { role: string; content: string }[] };

    return NextResponse.json({ content: "AI chat por implementar" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

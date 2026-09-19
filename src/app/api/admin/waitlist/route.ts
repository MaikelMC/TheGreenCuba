import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { readWaitlist } from "@/lib/waitlist-store";

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(readWaitlist());
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const category = searchParams.get("category");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

  let query = db.select().from(places).$dynamic();

  if (city) query = query.where(eq(places.city, city));
  if (category) query = query.where(eq(places.categoryId, category));

  query = query.limit(limit);

  const results = await query;

  return NextResponse.json(results);
}

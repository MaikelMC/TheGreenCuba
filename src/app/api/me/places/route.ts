import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { categories, places, savedPlaces } from "@/lib/db/schema";

export async function GET() {
  const user = await getAppUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, saved: [] }, { status: 401 });
  }

  const rows = await db
    .select({
      placeId: savedPlaces.placeId,
      name: places.name,
      category: categories.name,
      savedAt: savedPlaces.createdAt,
    })
    .from(savedPlaces)
    .innerJoin(places, eq(savedPlaces.placeId, places.id))
    .leftJoin(categories, eq(places.categoryId, categories.id))
    .where(eq(savedPlaces.userId, user.id))
    .orderBy(desc(savedPlaces.createdAt));

  return NextResponse.json({
    authenticated: true,
    saved: rows.map((row) => ({
      placeId: row.placeId,
      name: row.name,
      category: row.category ?? "Otro",
      savedAt: row.savedAt?.toISOString() ?? null,
    })),
  });
}

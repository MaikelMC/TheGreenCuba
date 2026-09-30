import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { TERMS_VERSION } from "@/lib/legal";

export async function GET(request: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.redirect(new URL("/register", request.url));
  }

  await db
    .update(users)
    .set({
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return NextResponse.redirect(
    new URL("/onboarding?showSessionNotice=1", request.url),
  );
}

// import { auth, currentUser } from "@clerk/nextjs/server";
// import { db } from "@/lib/db";
// import { users } from "@/lib/db/schema";
// import { eq } from "drizzle-orm";

// export async function getAuthUser() {
//   const { userId } = await auth();
//   if (!userId) return null;

//   const [user] = await db
//     .select()
//     .from(users)
//     .where(eq(users.clerkId, userId))
//     .limit(1);

//   return user ?? null;
// }

// export async function requireAuth() {
//   const user = await getAuthUser();
//   if (!user) throw new Error("Unauthorized");
//   return user;
// }

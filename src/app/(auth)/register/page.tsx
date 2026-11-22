import { AuthCard } from "@/components/auth/auth-card";
import { safeNext } from "@/lib/session";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      mode="register"
      next={safeNext(params.next)}
      googleEnabled={Boolean(
        process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
      )}
    />
  );
}

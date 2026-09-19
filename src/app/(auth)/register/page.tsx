import { AuthCard } from "@/components/auth/auth-card";
import { safeNext } from "@/lib/session";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <AuthCard mode="register" next={safeNext(params.next)} />;
}

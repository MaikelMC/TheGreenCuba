import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getAppUser } from "@/lib/auth/user";
import { safeNext } from "@/lib/session";

const SECTION_NAMES: Record<string, string> = {
  "/admin": "el panel de administración",
  "/business": "el panel de negocio",
};

const ROLE_NAMES: Record<string, string> = {
  user: "usuario",
  owner: "negocio",
  admin: "administrador",
};

/**
 * Pantalla de acceso. Es un componente de servidor a propósito: lee la sesión
 * para poder distinguir los dos motivos por los que alguien llega aquí.
 *
 * Cuando el `proxy.ts` o el layout de una sección mandan a alguien que **ya
 * tiene sesión** pero no el rol, aquí no se le enseña un formulario —ya está
 * dentro— sino el aviso. Si se enseñara el formulario, la persona escribiría su
 * contraseña otra vez sin entender nada.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; motivo?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const user = await getAppUser();

  if (params.motivo === "rol" && user) {
    const section = (next && SECTION_NAMES[next.split("?")[0]!]) ?? null;

    return (
      <div className="rounded-4xl border border-ink/5 bg-white shadow-soft p-gap-lg flex flex-col gap-gap-sm animate-fade-up">
        <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldOff size={22} strokeWidth={1.8} />
        </span>

        <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-destructive">
          Sin acceso
        </span>

        <h1 className="font-lv-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Esta sección no es para tu cuenta
        </h1>

        <p className="text-small text-ink-soft/75 text-pretty">
          Has entrado como{" "}
          <span className="font-semibold text-ink">{ROLE_NAMES[user.role]}</span> con{" "}
          <span className="font-semibold text-ink">{user.email}</span>
          {section ? `, y ${section} pide otro rol.` : ", y esa sección pide otro rol."}
        </p>

        <div className="flex flex-wrap gap-gap-xs pt-gap-xs">
          <Link
            href="/home"
            className="inline-flex items-center justify-center h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98]"
          >
            Volver al inicio
          </Link>
          <SignOutButton />
        </div>
      </div>
    );
  }

  return <AuthCard mode="login" next={next} />;
}

import Link from "next/link";
import { cn } from "@/lib/utils";

interface LoginButtonProps {
  className?: string;
  fullWidth?: boolean;
}

/**
 * Botón de la landing para quien **ya tiene cuenta**: lleva a `/login`.
 *
 * Antes era «Registrarse» y mandaba a `/register?next=/onboarding`. El alta no
 * desaparece de la landing —es el botón «Probar La Verde» de la cabecera de
 * portada, que es donde la ve alguien nuevo—, pero repetida aquí se comía el
 * único sitio para entrar los que ya son usuarios.
 */
export function LoginButton({ className, fullWidth }: LoginButtonProps) {
  return (
    <Link
      href="/login"
      className={cn(
        // `.btn-pill` del design system: pastilla, transición de 500 ms con
        // easeOutQuint en línea, y halo del propio verde del botón.
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-verde-400 px-6 py-3 font-lv-display text-sm font-semibold leading-none text-verde-950",
        "shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)]",
        "transition-all duration-500 ease-outquint",
        "hover:bg-verde-300 active:scale-[0.98]",
        fullWidth && "w-full",
        className,
      )}
    >
      Iniciar sesión
    </Link>
  );
}

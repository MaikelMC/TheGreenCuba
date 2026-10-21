import Link from "next/link";
import { cn } from "@/lib/utils";

interface LoginButtonProps {
  className?: string;
  fullWidth?: boolean;
}

/**
 * Botón de entrada para quien **ya tiene cuenta**: lleva a `/login`.
 * Lo comparte el menú de usuario, así que se queda aunque la portada nueva
 * use sus propios botones.
 */
export function LoginButton({ className, fullWidth }: LoginButtonProps) {
  return (
    <Link
      href="/login"
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-verde-400 px-6 py-3 font-lv-display text-sm font-semibold leading-none text-verde-950",
        "shadow-primary-halo",
        "transition duration-500 ease-outquint",
        "hover:bg-verde-300 active:scale-[0.98]",
        fullWidth && "w-full",
        className,
      )}
    >
      Iniciar sesión
    </Link>
  );
}

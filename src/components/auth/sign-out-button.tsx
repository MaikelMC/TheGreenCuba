"use client";

import { ArrowLeft } from "lucide-react";
import { logout } from "@/lib/logout";

/**
 * Cambiar de cuenta desde la pantalla de aviso. Va como botón y no como enlace
 * porque cerrar sesión borra una cookie: un `GET` no debería cambiar el estado
 * de nadie.
 *
 * Es un componente aparte para que la página pueda seguir siendo de servidor:
 * `logout()` toca `window`, y el servidor no tiene.
 */
export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="inline-flex items-center gap-gap-xs h-11 px-gap-lg rounded-full border border-ink/10 bg-white text-ink font-lv-display text-small font-semibold hover:border-verde-300 hover:bg-verde-50 transition-all duration-500 ease-outquint active:scale-[0.98] cursor-pointer"
    >
      <ArrowLeft size={16} strokeWidth={1.8} />
      Entrar con otra cuenta
    </button>
  );
}

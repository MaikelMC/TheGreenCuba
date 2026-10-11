"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MoonStar, SunMedium } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * El interruptor de modo claro/oscuro, en un disco.
 *
 * El estilo por defecto es el mismo disco blanco flotante que la campana
 * (`MapNotifications`): así se apila debajo sin parecer otro control. En la
 * cabecera de la landing, que va sobre la pastilla oscura, se le pasa un
 * `className` que le quita el fondo y deja el icono en blanco.
 *
 * `mounted` es obligatorio: en el servidor `resolvedTheme` es `undefined`, y
 * sin la guarda el primer render del cliente pinta el icono contrario al del
 * HTML —el desajuste de hidratación clásico de `next-themes`—.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label="Cambiar entre modo claro y oscuro"
      className={cn(
        "grid size-11 place-items-center rounded-full border border-ink/10 bg-white text-ink shadow-soft transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-600",
        className,
      )}
    >
      {dark ? (
        <SunMedium size={18} strokeWidth={1.8} />
      ) : (
        <MoonStar size={18} strokeWidth={1.8} />
      )}
    </button>
  );
}

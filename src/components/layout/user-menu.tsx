"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { User, Building2, ShieldCheck } from "lucide-react";

/* Hairline entre filas en vez de `<div>` separadores sueltos: es el mismo
   idioma que las filas de la pantalla de preferencias. */
const ITEM =
  "w-full flex items-center gap-gap-sm px-gap-md py-[10px] text-small text-ink border-b border-ink/5 last:border-none hover:bg-verde-50 transition-colors duration-500 text-left";

const ITEMS = [
  { path: "/profile", label: "Perfil de usuario", icon: User, delay: 0.05 },
  { path: "/business", label: "Business panel", icon: Building2, delay: 0.09 },
  { path: "/admin", label: "Panel de administración", icon: ShieldCheck, delay: 0.13 },
];

export function UserMenu({ initial }: { initial?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Verde casi tinta, como la pastilla de la cabecera de la landing: sobre
          la barra clara del header es lo único que se lee de un vistazo. El
          `verde-50` anterior se perdía contra el `sand-warm`. */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        className="size-11 shrink-0 rounded-full bg-verde-950 grid place-items-center text-white font-lv-display font-bold text-small transition-colors duration-500 hover:bg-verde-800"
        aria-label="Menú de usuario"
      >
        {initial ?? <User size={18} strokeWidth={1.8} />}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+6px)] w-[200px] bg-white border border-ink/5 rounded-2xl shadow-card z-50 overflow-hidden"
          >
            {ITEMS.map(({ path, label, icon: Icon, delay }) => (
              <motion.button
                key={path}
                type="button"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay, duration: 0.3 }}
                onClick={() => handleSelect(path)}
                className={ITEM}
              >
                <Icon size={16} strokeWidth={1.8} className="text-verde-600 shrink-0" />
                {label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

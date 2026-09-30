"use client";

import { createContext, useContext, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";

interface FormSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/* Acordeón de una sola hoja abierta.

   El formulario de negocio tiene entre nueve y doce secciones, y abrirlas todas
   dejaba la pantalla como un muro de campos por el que había que bajar entero
   para llegar a uno. Cerradas, se ve la lista de títulos —que es lo que el dueño
   viene a buscar— y despliega solo la que va a tocar.

   El estado vive en el grupo y no en cada sección porque son hermanas: sin un
   sitio común no hay forma de cerrar la anterior al abrir la siguiente.

   La flecha es el asa, pero el área táctil es la fila entera: la flecha sola son
   18 px, por debajo de lo que pide un dedo. */
const SectionsContext = createContext<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
} | null>(null);

export function FormSections({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <SectionsContext.Provider value={{ openId, setOpenId }}>
      <div className={cn("space-y-gap-md", className)}>{children}</div>
    </SectionsContext.Provider>
  );
}

/* Ojo con las validaciones: el error sale en la barra de abajo, junto a
   «Guardar», y el campo que lo provoca puede estar dentro de una sección
   cerrada. Los mensajes de los formularios nombran su sección por eso. */
export function FormSection({
  title,
  icon,
  children,
  className,
}: FormSectionProps) {
  const group = useContext(SectionsContext);
  /* Fuera de un `FormSections` la sección sigue funcionando sola. */
  const [selfOpen, setSelfOpen] = useState(false);

  /* `useId` y no un índice de render: el índice se descoloca con el doble
     renderizado de StrictMode y con las secciones que se montan según el caso. */
  const id = useId();
  const open = group ? group.openId === id : selfOpen;

  function toggle() {
    if (!group) {
      setSelfOpen((prev) => !prev);
      return;
    }
    group.setOpenId(group.openId === id ? null : id);
  }

  return (
    <div
      className={cn(
        "bg-white border border-ink/5 rounded-2xl overflow-hidden shadow-soft",
        className,
      )}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.995 }}
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center justify-between w-full p-gap-md border-b border-ink/5 hover:bg-sand transition-colors duration-500 ease-outquint"
      >
        <span className="font-lv-display text-body font-semibold text-ink flex items-center gap-gap-xs">
          {icon && <span className="text-verde-600">{icon}</span>}
          {title}
        </span>
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="grid place-items-center"
        >
          <ChevronDown
            size={18}
            strokeWidth={1.8}
            className="text-ink-soft/75"
          />
        </motion.span>
      </motion.button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="p-gap-md flex flex-col gap-gap-md">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

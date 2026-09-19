"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";

interface FormSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  icon,
  defaultOpen = true,
  children,
  className,
}: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("bg-white border border-ink/5 rounded-2xl overflow-hidden shadow-soft", className)}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.995 }}
        onClick={() => setOpen((prev) => !prev)}
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
          <ChevronDown size={18} strokeWidth={1.8} className="text-ink-soft/75" />
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
            <div className="p-gap-md flex flex-col gap-gap-md">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type ActivityType = "search" | "view" | "save" | "nav";

interface ActivityItemProps {
  type: ActivityType;
  children: React.ReactNode;
  time: string;
  className?: string;
  index?: number;
}

/* Cuatro tonos dentro de la paleta verde/arena. Antes eran lv-blue, lv-amber y
   lv-teal, que no existen en el sistema. El punto es decorativo: el tipo de
   evento lo dice el texto, no el color. */
const dotStyles: Record<ActivityType, string> = {
  search: "bg-verde-400",
  view: "bg-verde-600",
  save: "bg-verde-300",
  nav: "bg-ink/20",
};

export function ActivityItem({ type, children, time, className, index = 0 }: ActivityItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ x: 4 }}
      className={cn("flex items-center gap-gap-sm py-gap-sm border-b border-ink/5 last:border-b-0", className)}
    >
      <motion.span
        className={cn("size-2 rounded-full shrink-0", dotStyles[type])}
        animate={{ scale: [1, 1.35, 1] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: index * 0.2 }}
      />
      <span className="flex-1 text-small text-ink min-w-0 [&_strong]:font-semibold">
        {children}
      </span>
      <span className="font-lv-display text-meta text-ink-soft/75 whitespace-nowrap">{time}</span>
    </motion.div>
  );
}

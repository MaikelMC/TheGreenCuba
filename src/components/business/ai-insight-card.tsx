"use client";

import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIInsightCardProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function AIInsightCard({
  label = "Insight de la IA",
  children,
  className,
  delay = 0,
}: AIInsightCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "bg-gradient-to-br from-accent/[0.06] to-accent/[0.02] border border-accent/15 rounded-lv-lg p-gap-md flex gap-gap-sm items-start",
        className,
      )}
    >
      <motion.div
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="size-10 rounded-lv bg-accent grid place-items-center shrink-0 text-white"
      >
        <Sparkles size={20} strokeWidth={1.5} />
      </motion.div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-accent uppercase tracking-[0.04em] font-medium mb-[4px]">
          {label}
        </div>
        <div className="text-small leading-relaxed text-foreground [&_strong]:font-semibold">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

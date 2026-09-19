"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface OfferBannerProps {
  label: string;
  text: string;
  expiry: string;
  visible?: boolean;
  className?: string;
}

export function OfferBanner({
  label,
  text,
  expiry,
  visible = true,
  className,
}: OfferBannerProps) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={cn(
        "mx-gap-md mb-gap-md p-gap-md bg-verde-50 border border-verde-200 rounded-2xl",
        className,
      )}
    >
      <div className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600 mb-[6px]">
        {label}
      </div>
      <div className="font-lv-display text-small font-semibold text-ink leading-snug">
        {text}
      </div>
      <div className="text-meta text-ink-soft/75 mt-[6px]">{expiry}</div>
    </motion.div>
  );
}

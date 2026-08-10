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
        "mx-gap-md mb-gap-md p-gap-md bg-gradient-to-br from-lv-amber/10 to-lv-amber/4 border border-lv-amber/20 rounded-lv-lg",
        className,
      )}
    >
      <div className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-lv-amber mb-[6px]">
        {label}
      </div>
      <div className="font-display text-small font-semibold text-foreground leading-snug">
        {text}
      </div>
      <div className="text-xs text-muted-foreground mt-[6px]">{expiry}</div>
    </motion.div>
  );
}

"use client";

import { motion } from "motion/react";
import { Image } from "lucide-react";
import { cn, currencyLabel } from "@/lib/utils";

interface MenuItemProps {
  name: string;
  description: string;
  price: number;
  currency: string;
  tag?: {
    label: string;
    variant: "popular" | "new" | "offer";
  };
  imageEmoji?: string;
  className?: string;
  index?: number;
}

const tagStyles: Record<string, string> = {
  popular: "bg-lv-amber/12 text-lv-amber",
  new: "bg-accent/10 text-accent",
  offer: "bg-destructive/10 text-destructive",
};

export function MenuItem({
  name,
  description,
  price,
  currency,
  tag,
  imageEmoji,
  className,
  index = 0,
}: MenuItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ x: 4 }}
      className={cn("flex gap-gap-md py-gap-md border-b border-border last:border-b-0", className)}
    >
      {/* Image placeholder */}
      <div className="size-[72px] rounded-lv bg-lv-sand-200 shrink-0 grid place-items-center overflow-hidden">
        {imageEmoji ? (
          <span className="text-[28px]">{imageEmoji}</span>
        ) : (
          <Image size={24} strokeWidth={1.5} className="text-muted-foreground opacity-50" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-display text-small font-semibold text-foreground mb-[2px]">
          {name}
        </div>
        <div className="text-meta text-muted-foreground leading-snug line-clamp-2">
          {description}
        </div>
        <div className="flex items-center justify-between mt-[6px]">
          <span className="font-mono text-small font-medium text-foreground">
            {price}{" "}
            <span className="text-xs text-muted-foreground font-normal">{currencyLabel(currency)}</span>
          </span>
          {tag && (
            <span
              className={cn(
                "px-[8px] py-[2px] rounded-full font-mono text-[10px] font-medium uppercase tracking-[0.03em]",
                tagStyles[tag.variant],
              )}
            >
              {tag.label}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}


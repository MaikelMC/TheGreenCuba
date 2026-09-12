"use client";

import { Heart, ArrowRight, Star, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface PlaceCardProps {
  name: string;
  category: string;
  rating: number;
  distance: string;
  price: string;
  tags: { label: string; variant?: "mlc" | "open" | "default" }[];
  emoji?: string;
  selected?: boolean;
  liked?: boolean;
  index?: number;
  onSelect?: () => void;
  onLike?: () => void;
  onDetail?: () => void;
  onLocate?: () => void;
}

const tagStyles: Record<string, string> = {
  mlc: "bg-amber/10 text-lv-amber border-amber/20",
  open: "bg-lv-teal/10 text-lv-teal border-lv-teal/20",
  default: "bg-background text-muted-foreground border-border",
};

export function PlaceCard({
  name,
  category,
  rating,
  distance,
  price,
  tags,
  emoji = "📍",
  selected,
  liked,
  index = 0,
  onSelect,
  onLike,
  onDetail,
  onLocate,
}: PlaceCardProps) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect?.()}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "flex gap-[14px] p-[14px] bg-surface border rounded-lv-lg cursor-pointer transition-colors duration-normal",
        selected
          ? "border-accent shadow-[0_0_0_2px_var(--accent-soft)]"
          : "border-border hover:border-accent/30 hover:shadow-lv-sm",
      )}
    >
      {/* Thumbnail */}
      <div className="size-16 rounded-lv shrink-0 grid place-items-center text-[28px] bg-gradient-to-br from-accent/10 to-lv-green-200/15">
        {emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-display text-body font-semibold tracking-[-0.01em] truncate">
          {name}
        </div>
        <div className="text-[13px] text-muted-foreground mb-[6px]">
          {category}
        </div>
        <div className="flex items-center gap-gap-xs flex-wrap">
          {rating > 0 && (
            <span className="inline-flex items-center gap-[3px] font-mono text-[12px] font-medium text-lv-amber">
              <Star size={12} fill="currentColor" />
              {rating}
            </span>
          )}
          <span className="font-mono text-[12px] text-muted-foreground">
            {distance}
          </span>
          <span className="font-mono text-[12px] text-muted-foreground">
            {price}
          </span>
        </div>
        {tags.length > 0 && (
          <div className="flex gap-[4px] flex-wrap mt-[6px]">
            {tags.map((tag) => (
              <span
                key={tag.label}
                className={cn(
                  "text-[11px] px-2 py-[2px] rounded-full border",
                  tagStyles[tag.variant ?? "default"],
                )}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col justify-between items-end shrink-0">
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={(e) => {
            e.stopPropagation();
            onLocate?.();
          }}
          className="size-10 rounded-full grid place-items-center text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
          aria-label="Ver en el mapa"
          title="Ver en el mapa"
        >
          <MapPin size={16} strokeWidth={2} />
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 1.35 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
          onClick={(e) => {
            e.stopPropagation();
            onLike?.();
          }}
          className={cn(
            "size-10 rounded-full grid place-items-center transition-colors",
            liked
              ? "text-lv-red"
              : "text-muted-foreground hover:text-accent hover:bg-accent/10",
          )}
          aria-label="Favorito"
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} strokeWidth={2} />
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={(e) => {
            e.stopPropagation();
            onDetail?.();
          }}
          className="size-10 rounded-full grid place-items-center text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
          aria-label="Ver detalle"
        >
          <ArrowRight size={16} strokeWidth={2} />
        </motion.button>
      </div>
    </motion.div>
  );
}

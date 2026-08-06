"use client";

import { Heart, ArrowRight, Star, MapPin } from "lucide-react";
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
  onSelect,
  onLike,
  onDetail,
  onLocate,
}: PlaceCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect?.()}
      className={cn(
        "flex gap-[14px] p-[14px] bg-surface border rounded-lv-lg cursor-pointer transition-all duration-normal",
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLocate?.();
          }}
          className="size-8 rounded-full grid place-items-center text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all"
          aria-label="Ver en el mapa"
          title="Ver en el mapa"
        >
          <MapPin size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLike?.();
          }}
          className={cn(
            "size-8 rounded-full grid place-items-center transition-all",
            liked
              ? "text-lv-red"
              : "text-muted-foreground hover:text-accent hover:bg-accent/10",
          )}
          aria-label="Favorito"
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDetail?.();
          }}
          className="size-8 rounded-full grid place-items-center text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all"
          aria-label="Ver detalle"
        >
          <ArrowRight size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

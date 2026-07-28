"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Coffee, MapPin } from "lucide-react";

type MarkerVariant = "default" | "boosted" | "selected" | "user";

interface MapMarkerProps {
  variant?: MarkerVariant;
  style?: React.CSSProperties;
  icon?: ReactNode;
  selected?: boolean;
  searching?: boolean;
  onClick?: () => void;
  "data-place"?: string;
}

const variantStyles: Record<MarkerVariant, string> = {
  default:
    "size-8 bg-accent shadow-[0_2px_8px_oklch(62%_0.16_145_/_0.35)]",
  boosted:
    "size-10 bg-lv-amber shadow-[0_3px_12px_oklch(75%_0.15_75_/_0.4)] border-[3px] border-white",
  selected:
    "size-[44px] bg-accent shadow-[0_4px_16px_oklch(62%_0.16_145_/_0.45)] border-[3px] border-white z-20",
  user:
    "size-5 bg-lv-blue border-[3px] border-white shadow-[0_2px_12px_oklch(62%_0.14_250_/_0.4)] z-[25]",
};

export function MapMarker({
  variant = "default",
  style: positionStyle,
  icon,
  selected,
  searching,
  onClick,
  "data-place": dataPlace,
}: MapMarkerProps) {
  if (variant === "user") {
    return (
      <div
        className={cn("map-marker absolute rounded-full grid place-items-center cursor-pointer transition-transform duration-normal ease-out hover:scale-110", variantStyles.user)}
        style={positionStyle}
      >
        <div className="size-2 rounded-full bg-white" />
        <div className="absolute size-20 rounded-full bg-lv-blue/8 border border-lv-blue/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "map-marker absolute rounded-full grid place-items-center cursor-pointer transition-all duration-normal ease-out z-10 hover:scale-110 hover:z-[15]",
        variantStyles[variant],
        selected && variantStyles.selected,
        searching && "animate-[markerSearch_1.5s_ease-in-out_infinite]",
      )}
      style={positionStyle}
      onClick={onClick}
      data-place={dataPlace}
    >
      {variant === "boosted" && (
        <div className="absolute inset-0 rounded-full bg-accent opacity-0 animate-pulse-ring pointer-events-none" />
      )}
      <span className="text-white">
        {icon ?? <Coffee size={14} strokeWidth={2.2} />}
      </span>
    </div>
  );
}

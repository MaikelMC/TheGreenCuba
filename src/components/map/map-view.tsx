"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MapViewProps {
  children?: ReactNode;
  className?: string;
  searching?: boolean;
}

export function MapView({ children, className, searching }: MapViewProps) {
  return (
    <div
      className={cn(
        "absolute inset-0",
        "bg-[length:40px_40px,40px_40px,100%_100%,100%_100%,100%_100%,100%_100%,100%_100%,100%_100%]",
        "[background-image:linear-gradient(90deg,oklch(88%_0.008_85_/_0.6)_1px,transparent_1px),linear-gradient(0deg,oklch(88%_0.008_85_/_0.6)_1px,transparent_1px),linear-gradient(90deg,transparent_48%,oklch(85%_0.012_85)_48%,oklch(85%_0.012_85)_52%,transparent_52%),linear-gradient(0deg,transparent_30%,oklch(85%_0.012_85)_30%,oklch(85%_0.012_85)_33%,transparent_33%),radial-gradient(ellipse_at_85%_20%,oklch(78%_0.06_230_/_0.25)_0%,transparent_50%),radial-gradient(circle_at_20%_60%,oklch(82%_0.08_145_/_0.2)_0%,transparent_15%),radial-gradient(circle_at_65%_75%,oklch(82%_0.08_145_/_0.15)_0%,transparent_10%),oklch(92%_0.008_85)]",
        searching && "map-markers-searching",
        className,
      )}
    >
      {children}
    </div>
  );
}

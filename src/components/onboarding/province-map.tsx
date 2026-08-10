"use client";

import dynamic from "next/dynamic";
import { locationLabel } from "@/lib/user-preferences-store";

const ProvinceMapInner = dynamic(
  () =>
    import("./province-map-inner").then((m) => ({ default: m.ProvinceMapInner })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-[oklch(92%_0.008_85)]" />
    ),
  },
);

export function ProvinceMap({ location }: { location: string }) {
  return (
    <div className="relative h-[180px] rounded-lv-lg overflow-hidden border border-border mb-5 flex-shrink-0">
      <ProvinceMapInner location={location} />
      <span className="absolute left-2 top-2 z-[500] bg-surface/85 backdrop-blur px-2 py-1 rounded-lv font-mono text-[11px] text-foreground font-medium shadow-lv-sm">
        {locationLabel(location)}
      </span>
    </div>
  );
}
"use client";

import dynamic from "next/dynamic";
import { locationLabel } from "@/lib/user-preferences-store";

const ProvinceMapInner = dynamic(
  () =>
    import("./province-map-inner").then((m) => ({ default: m.ProvinceMapInner })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-sand-deep" />
    ),
  },
);

export function ProvinceMap({ location }: { location: string }) {
  return (
    <div className="relative h-[180px] rounded-2xl overflow-hidden border border-ink/5 mb-5 flex-shrink-0">
      <ProvinceMapInner location={location} />
      <span className="absolute left-2 top-2 z-[500] bg-sand-warm/85 backdrop-blur px-2.5 py-1 rounded-full font-lv-display text-meta text-ink font-semibold shadow-soft">
        {locationLabel(location)}
      </span>
    </div>
  );
}
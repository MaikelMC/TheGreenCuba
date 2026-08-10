"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { Header } from "@/components/layout/header";
import { SearchProvider } from "@/providers/search-provider";
import { PlacesProvider } from "@/providers/places-provider";

function useShowGlobalHeader() {
  const pathname = usePathname();
  return (
    pathname !== "/business" &&
    !pathname.startsWith("/profile") &&
    !pathname.startsWith("/place")
  );
}

export default function MainLayout({ children }: { children: ReactNode }) {
  const showHeader = useShowGlobalHeader();

  return (
    <MotionConfig reducedMotion="user">
      <PlacesProvider>
        <SearchProvider>
          {showHeader && <Header />}
          <main className={showHeader ? "pt-[var(--header-h)] min-h-screen" : "min-h-screen"}>
            {children}
          </main>
        </SearchProvider>
      </PlacesProvider>
    </MotionConfig>
  );
}

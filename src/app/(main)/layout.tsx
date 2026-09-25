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
    !pathname.startsWith("/place") &&
    !pathname.startsWith("/notifications")
  );
}

export default function MainLayout({ children }: { children: ReactNode }) {
  const showHeader = useShowGlobalHeader();

  return (
    <MotionConfig reducedMotion="user">
      <PlacesProvider>
        <SearchProvider>
          {showHeader && <Header />}
          {/* min-h-screen + min-h-dvh: el primero es el respaldo para navegadores
              sin unidades de viewport dinámicas; el segundo gana donde sí las hay
              y evita que la barra de URL del móvil descuadre el alto. */}
          <main className={showHeader ? "pt-[var(--header-h)] min-h-screen min-h-dvh" : "min-h-screen min-h-dvh"}>
            {children}
          </main>
        </SearchProvider>
      </PlacesProvider>
    </MotionConfig>
  );
}

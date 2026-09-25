"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationsView } from "@/components/profile/notifications-view";

export default function NotificationsPage() {
  const router = useRouter();

  return (
    <main className="relative min-h-dvh bg-sand font-lv text-ink">
      <header className="sticky top-0 z-20 flex h-header items-center gap-2 border-b border-ink/5 bg-sand-warm/90 px-3 backdrop-blur-[16px] sm:gap-gap-sm sm:px-gap-md">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Volver atrás"
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft/75 transition-colors hover:bg-verde-50 hover:text-verde-600"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </button>
        <h1 className="truncate font-lv-display text-[18px] font-bold tracking-[-0.02em] text-ink">
          Notificaciones
        </h1>
        <div className="min-w-0 flex-1" />
        <UserMenu />
      </header>
      <NotificationsView />
    </main>
  );
}
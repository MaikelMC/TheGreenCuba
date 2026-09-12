"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard,
  Edit,
  Eye,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { UserMenu } from "@/components/layout/user-menu";
import { EASE } from "@/lib/motion";

export type PanelView = "dashboard" | "editor" | "preview" | "settings";

interface PanelShellProps {
  businessName?: string;
  defaultView?: PanelView;
  children: (
    activeView: PanelView,
    setView: (view: PanelView) => void,
  ) => React.ReactNode;
  className?: string;
}

interface NavItem {
  id: PanelView;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "editor", label: "Editar", icon: Edit },
  { id: "preview", label: "Vista previa", icon: Eye },
  { id: "settings", label: "Ajustes", icon: Settings },
];

const SIDEBAR_ITEMS: NavItem[] = [
  { id: "dashboard" as PanelView, label: "Dashboard", icon: LayoutDashboard },
  { id: "editor" as PanelView, label: "Editar ficha", icon: Edit },
  { id: "preview" as PanelView, label: "Vista previa", icon: Eye },
  { id: "settings" as PanelView, label: "Ajustes", icon: Settings },
];

export function PanelShell({
  businessName = "St. Pauli Restaurant-Bar",
  defaultView = "dashboard",
  children,
  className,
}: PanelShellProps) {
  const [activeView, setActiveView] = useState<PanelView>(defaultView);

  const viewTitles: Record<PanelView, string> = {
    dashboard: "Dashboard",
    editor: "Editar ficha",
    preview: "Vista previa",
    settings: "Ajustes",
  };

  return (
    <div className={cn("h-dvh bg-background flex flex-col", className)}>
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur border-b border-border h-header flex items-center px-gutter gap-gap-sm shrink-0">
        <Link
          href="/home"
          className="size-8 grid place-items-center rounded-lg hover:bg-accent/10 transition-colors text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
        </Link>
        <div className="font-display font-bold text-[18px] text-accent tracking-[-0.02em] whitespace-nowrap">
          La Verde <span className="text-foreground font-medium">Panel</span>
        </div>
        <div className="flex-1 min-w-0" />
        <span className="font-mono text-xs font-medium bg-accent/10 text-accent px-[8px] py-[2px] rounded-full border border-accent/20 whitespace-nowrap">
          Negocio verificado
        </span>
        <UserMenu initial="SP" />
      </header>

      {/* Shell */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-[260px] bg-surface border-r border-border shrink-0 px-gap-md pt-gap-md gap-[2px]">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={cn(
                  "relative flex items-center gap-gap-sm w-full px-gap-md py-gap-sm rounded-lv text-small font-medium transition-colors duration-fast text-left border-none bg-transparent cursor-pointer font-body",
                  isActive ? "text-accent font-semibold" : "text-foreground hover:bg-muted",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="panel-nav-side"
                    className="absolute inset-0 rounded-lv bg-accent/10"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon size={20} strokeWidth={1.5} className="relative shrink-0 z-10" />
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}

          <div className="h-[1px] bg-border mx-gap-md my-gap-sm" />

          {/* Business card */}
          <div className="mx-gap-md mt-auto mb-gap-md p-gap-md bg-muted rounded-lv-lg flex flex-col gap-gap-xs">
            <div className="font-display text-small font-bold">{businessName}</div>
            <div className="flex items-center gap-[6px] text-meta text-muted-foreground">
              <span className="size-[6px] rounded-full bg-lv-teal" />
              Activo en La Verde
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-gap-md pb-[80px] lg:pb-gap-xl lg:p-gap-xl flex flex-col min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="flex flex-col min-h-full"
              >
                {children(activeView, setActiveView)}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Bottom Nav (mobile) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-border h-16 pb-safe-bottom flex lg:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-[2px] text-xs font-medium transition-colors duration-fast bg-transparent border-none cursor-pointer font-body",
                isActive ? "text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="panel-nav-bottom"
                  className="absolute top-0 h-[2px] w-8 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon size={22} strokeWidth={1.5} className="relative z-10" />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

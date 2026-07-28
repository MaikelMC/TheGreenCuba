"use client";

import { useState, useCallback } from "react";
import {
  LayoutDashboard,
  Edit,
  Eye,
  Settings,
  Sparkles,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export type PanelView = "dashboard" | "editor" | "preview" | "settings";

interface PanelShellProps {
  businessName?: string;
  defaultView?: PanelView;
  children: (activeView: PanelView) => React.ReactNode;
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

const SIDEBAR_SECTIONS = [
  {
    label: "Principal",
    items: [
      { id: "dashboard" as PanelView, label: "Dashboard", icon: LayoutDashboard },
      { id: "editor" as PanelView, label: "Editar ficha", icon: Edit },
      { id: "preview" as PanelView, label: "Vista previa", icon: Eye },
    ],
  },
  {
    label: "Cuenta",
    items: [
      { id: "settings" as PanelView, label: "Ajustes", icon: Settings },
    ],
  },
];

export function PanelShell({
  businessName = "La Guarida",
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
    <div className={cn("min-h-screen bg-background flex flex-col", className)}>
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur border-b border-border h-header flex items-center px-gutter gap-gap-sm">
        <div className="font-display font-bold text-[18px] text-accent tracking-[-0.02em] whitespace-nowrap">
          La Verde <span className="text-foreground font-medium">Panel</span>
        </div>
        <div className="font-display text-small font-semibold text-muted-foreground flex-1 min-w-0 truncate">
          {viewTitles[activeView]}
        </div>
        <span className="font-mono text-xs font-medium bg-accent/10 text-accent px-[8px] py-[2px] rounded-full border border-accent/20 whitespace-nowrap">
          Negocio verificado
        </span>
        <Avatar className="size-9">
          <AvatarFallback className="bg-gradient-to-br from-accent to-accent-hover text-white font-display font-bold text-small">
            LG
          </AvatarFallback>
        </Avatar>
      </header>

      {/* Shell */}
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-[260px] bg-surface border-r border-border sticky top-header h-[calc(100vh-var(--header-h))] overflow-y-auto">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.label} className="px-gap-md mb-gap-lg">
              <div className="font-mono text-xs text-muted-foreground uppercase tracking-[0.04em] px-gap-sm mb-gap-xs">
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    className={cn(
                      "flex items-center gap-gap-sm w-full px-gap-md py-gap-sm rounded-lv text-small font-medium transition-all duration-fast text-left border-none bg-transparent cursor-pointer font-body",
                      isActive
                        ? "bg-accent/10 text-accent font-semibold"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon size={20} strokeWidth={1.5} className="shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}

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
        <main className="flex-1 min-w-0">
          <div className="p-gap-md pb-[80px] lg:pb-gap-xl lg:px-gap-2xl lg:py-gap-xl lg:max-w-[900px] animate-fade-in">
            {children(activeView)}
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
                "flex-1 flex flex-col items-center justify-center gap-[2px] text-xs font-medium transition-colors duration-fast bg-transparent border-none cursor-pointer font-body",
                isActive ? "text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={22} strokeWidth={1.5} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

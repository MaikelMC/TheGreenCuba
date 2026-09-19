"use client";

import { useEffect, useState } from "react";
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
import { MobileDock } from "@/components/layout/mobile-dock";
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
  businessName,
  defaultView = "dashboard",
  children,
  className,
}: PanelShellProps) {
  const [activeView, setActiveView] = useState<PanelView>(defaultView);
  const [sessionName, setSessionName] = useState<string | null>(null);

  /* El nombre del negocio sale de `/api/me`, que lo lee de `business_owners`.
     Antes estaba fijo en "St. Pauli Restaurant-Bar", luego salió del campo
     `business` de la cuenta de demo; con la autenticación de Neon lo que hay es
     la fila que dice quién lleva qué sitio. Se pide aquí y no en cada página
     porque este armazón ya envuelve las cuatro vistas.

     Mientras esa tabla no tenga filas —nadie ha reclamado un negocio todavía—
     `/api/me` devuelve `null` y se cae al nombre de la persona. */
  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: { authenticated: boolean; user: { business: string | null; name: string } | null }) => {
        if (alive && data.authenticated && data.user) {
          setSessionName(data.user.business ?? data.user.name);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const displayName = businessName ?? sessionName ?? "Mi negocio";

  return (
    <div className={cn("h-dvh bg-sand font-lv text-ink flex flex-col", className)}>
      {/* Top Bar. Igual que la cabecera del home: barra clara translúcida con
          hairline de tinta, no el `border-border` gris del sistema viejo. */}
      <header className="sticky top-0 z-50 bg-sand-warm/90 backdrop-blur-[16px] border-b border-ink/5 h-header flex items-center px-3 gap-2 sm:px-gap-md sm:gap-gap-sm shrink-0">
        <Link
          href="/home"
          className="size-9 grid place-items-center rounded-full hover:bg-verde-50 transition-colors duration-500 ease-outquint text-ink-soft/75 hover:text-verde-600 shrink-0"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <div className="font-lv-display font-bold text-[18px] text-ink tracking-[-0.02em] whitespace-nowrap">
          La Verde <span className="font-medium text-verde-600">Panel</span>
        </div>
        <div className="flex-1 min-w-0" />
        <span className="font-lv-display text-meta font-semibold bg-verde-50 text-verde-600 px-[10px] py-[3px] rounded-full border border-verde-200 whitespace-nowrap max-sm:hidden">
          Negocio verificado
        </span>
        {/* Sin `initial` fijo: la inicial la saca el menú del nombre de la sesión. */}
        <UserMenu />
      </header>

      {/* Shell */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-[260px] bg-white border-r border-ink/5 shrink-0 px-gap-sm pt-gap-md gap-[2px]">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={cn(
                  "relative flex items-center gap-gap-sm w-full px-gap-md py-[10px] rounded-full text-small font-medium transition-colors duration-500 ease-outquint text-left border-none bg-transparent cursor-pointer font-lv-display",
                  isActive ? "text-verde-700 font-semibold" : "text-ink-soft/75 hover:bg-sand",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="panel-nav-side"
                    className="absolute inset-0 rounded-full bg-verde-50"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon size={20} strokeWidth={1.8} className="relative shrink-0 z-10" />
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}

          <div className="h-px bg-ink/5 mx-gap-md my-gap-sm" />

          {/* Business card */}
          <div className="mx-gap-sm mt-auto mb-gap-md p-gap-md bg-sand border border-ink/5 rounded-2xl flex flex-col gap-gap-xs">
            <div className="font-lv-display text-small font-bold text-ink">{displayName}</div>
            <div className="flex items-center gap-[6px] text-meta text-ink-soft/75">
              <span className="size-[6px] rounded-full bg-verde-400" />
              Activo en La Verde
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {/* En móvil el aire se recorta a 12 px, como en la cabecera del home.
              Con los 16 px de escritorio más los 16 de cada `FormSection` se
              iban 64 px de los 360 de pantalla, y las filas de horarios no
              cabían.
              Aquí no vale el atajo `p-gap-*`: pone también `padding-bottom`, y
              como las variantes responsive salen después en el CSS, se comía el
              hueco del dock de 640 px para arriba, justo donde el dock sigue
              visible (`lg:hidden`). Por eso cada eje va por su cuenta y el único
              relleno de abajo es el del dock hasta `lg`. */}
          <div className="px-gap-sm pt-gap-sm pb-dock-clear sm:px-gap-md sm:pt-gap-md lg:px-gap-xl lg:pt-gap-xl lg:pb-gap-xl flex flex-col min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex flex-col min-h-full"
              >
                {children(activeView, setActiveView)}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Dock (móvil). La barra pegada al borde inferior deja paso a la misma
          pastilla flotante del perfil: el panel deja de parecer otra app. */}
      <MobileDock
        label="Secciones del panel"
        items={NAV_ITEMS.map(({ id, label, icon }) => ({
          key: id,
          label,
          icon,
          onSelect: () => setActiveView(id),
          active: activeView === id,
        }))}
      />
    </div>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard,
  Store,
  Tags,
  Bot,
  ArrowLeft,
  LogOut,
  ListTodo,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileDock } from "@/components/layout/mobile-dock";
import { EASE } from "@/lib/motion";
import { logout } from "@/lib/logout";

interface AdminNavItem {
  href: string;
  label: string;
  /** Rótulo de la barra inferior. Cinco pestañas a 360 px dejan 72 px por
      botón: "Lista de espera" (~87 px) y "Proveedores IA" (~81 px) no caben y
      partían en dos líneas, descuadrando la barra. */
  short: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/negocios", label: "Negocios", short: "Negocios", icon: Store },
  { href: "/admin/lista-de-espera", label: "Lista de espera", short: "Espera", icon: ListTodo },
  { href: "/admin/usuarios", label: "Usuarios", short: "Usuarios", icon: Users },
  { href: "/admin/categorias", label: "Categorías", short: "Categorías", icon: Tags },
  { href: "/admin/proveedores-ia", label: "Proveedores IA", short: "IA", icon: Bot },
];

function isActiveItem(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/* Misma carcasa que el panel de negocio: barra clara translúcida con hairline
   de tinta, pastillas en la barra lateral y filete verde en la inferior. Los
   dos paneles comparten lenguaje; solo cambia el acento de la marca. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  /* Antes borraba la marca de `localStorage` de la pantalla de bloqueo; ahora
     cierra la sesión de verdad, la misma que el resto del sitio. */
  const handleLogout = () => {
    void logout();
  };

  return (
    <div className="h-dvh bg-sand font-lv text-ink flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-sand-warm/90 backdrop-blur-[16px] border-b border-ink/5 h-header flex items-center px-3 gap-2 sm:px-gap-md sm:gap-gap-sm shrink-0">
        <Link
          href="/home"
          className="size-9 grid place-items-center rounded-full hover:bg-verde-50 transition-colors duration-500 ease-outquint text-ink-soft/75 hover:text-verde-600 shrink-0"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <div className="font-lv-display font-bold text-[18px] text-ink tracking-[-0.02em] whitespace-nowrap">
          La Verde <span className="font-medium text-verde-600">Admin</span>
        </div>
        <div className="flex-1 min-w-0" />
        <span className="font-lv-display text-meta font-semibold bg-verde-50 text-verde-600 px-[10px] py-[3px] rounded-full border border-verde-200 whitespace-nowrap max-sm:hidden">
          Panel de administración
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="size-9 rounded-full border border-ink/10 grid place-items-center text-ink-soft/75 hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors duration-500 ease-outquint shrink-0"
          aria-label="Cerrar sesión de administrador"
        >
          <LogOut size={16} strokeWidth={1.8} />
        </button>
      </header>

      {/* Shell */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-[260px] bg-white border-r border-ink/5 shrink-0 px-gap-sm pt-gap-md gap-[2px]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveItem(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-gap-sm w-full px-gap-md py-[10px] rounded-full text-small font-medium transition-colors duration-500 ease-outquint text-left border-none bg-transparent cursor-pointer font-lv-display",
                  isActive ? "text-verde-700 font-semibold" : "text-ink-soft/75 hover:bg-sand",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="admin-nav-side"
                    className="absolute inset-0 rounded-full bg-verde-50"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon size={20} strokeWidth={1.8} className="relative shrink-0 z-10" />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {/* En móvil el aire se recorta a 12 px, como en el panel de negocio.
              Cada eje por su cuenta: el atajo `p-gap-*` también pone
              `padding-bottom` y, como las variantes responsive salen después en
              el CSS, se comía el hueco del dock de 640 px para arriba, donde el
              dock sigue visible (`lg:hidden`). */}
          <div className="px-gap-sm pt-gap-sm pb-dock-clear sm:px-gap-md sm:pt-gap-md lg:px-gap-xl lg:pt-gap-xl lg:pb-gap-xl flex flex-col min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex flex-col min-h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Dock (móvil). Misma pastilla flotante que el perfil y el panel de
          negocio; aquí con los rótulos cortos, que es lo que cabe a cinco
          destinos. */}
      <MobileDock
        label="Secciones de administración"
        items={NAV_ITEMS.map((item) => ({
          key: item.href,
          label: item.short,
          icon: item.icon,
          href: item.href,
          active: isActiveItem(pathname, item),
        }))}
      />
    </div>
  );
}

"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { useState, useEffect } from "react";
import {
  BarChart3,
  LayoutDashboard,
  Store,
  Tags,
  Bot,
  ArrowLeft,
  Users,
  ClipboardList,
  Megaphone,
  LifeBuoy,
  BellRing,
  Send,
  Menu,
  X,
  ChevronRight,
  BadgeDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/layout/user-menu";
import { EASE } from "@/lib/motion";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

interface AdminNavItem {
  href: string;
  label: string;
  /** Rótulo de la barra inferior. Las pestañas a 360 px dejan unos 72 px por
      botón, y un rótulo que no quepa parte en dos líneas y descuadra la barra:
      «Proveedores IA» (~81 px) ya necesita el suyo. */
  short: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

/* Sin «Lista de espera»: se retiró con la sección nueva del perfil. Era un
   formulario que nadie podía rellenar —existían el store, la API y esta
   pantalla, pero ningún sitio que hiciera el `POST`— y ahora el alta de un
   negocio es cosa suya, desde `/profile?seccion=negocio`. */
const NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    short: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    short: "Analytics",
    icon: BarChart3,
  },
  {
    href: "/admin/negocios",
    label: "Negocios",
    short: "Negocios",
    icon: Store,
  },
  {
    href: "/admin/solicitudes",
    label: "Solicitudes",
    short: "Solicitudes",
    icon: ClipboardList,
  },
  {
    href: "/admin/publicaciones",
    label: "Publicaciones",
    short: "Publicar",
    icon: Send,
  },
  {
    href: "/admin/proyectos",
    label: "Proyectos",
    short: "Proyectos",
    icon: Megaphone,
  },
  {
    href: "/admin/soporte",
    label: "Soporte",
    short: "Soporte",
    icon: LifeBuoy,
  },
  {
    href: "/admin/notificaciones",
    label: "Notificaciones",
    short: "Avisos",
    icon: BellRing,
  },
  {
    href: "/admin/usuarios",
    label: "Usuarios",
    short: "Usuarios",
    icon: Users,
  },
  {
    href: "/admin/categorias",
    label: "Categorías",
    short: "Categorías",
    icon: Tags,
  },
  {
    href: "/admin/proveedores-ia",
    label: "Proveedores IA",
    short: "IA",
    icon: Bot,
  },
  {
    href: "/admin/planes",
    label: "Planes",
    short: "Planes",
    icon: BadgeDollarSign,
  },
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
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cerrar menú al navegar
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, searchParams]);

  /* Y cerrarlo si la ventana crece de 1024 px: ahí el cajón no existe —las
     secciones son la barra lateral— y quedaría abierto e invisible, con la
     trampa de foco puesta sobre algo que no se ve. */
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const cerrar = () => mq.matches && setMobileMenuOpen(false);
    mq.addEventListener("change", cerrar);
    return () => mq.removeEventListener("change", cerrar);
  }, [mobileMenuOpen]);

  return (
    <div className="admin-panel h-dvh bg-sand font-lv text-ink flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-sand-warm/90 backdrop-blur-[16px] border-b border-ink/5 h-header flex items-center px-3 gap-2 sm:px-gap-md sm:gap-gap-sm shrink-0">
        <Link
          href="/home"
          className="size-11 grid place-items-center rounded-full hover:bg-verde-50 transition-colors duration-500 ease-outquint text-ink-soft/75 hover:text-verde-600 shrink-0"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <div className="font-lv-display font-bold text-[18px] text-ink tracking-[-0.02em] whitespace-nowrap flex-1 truncate">
          <span translate="no">La Verde</span>{" "}
          <span className="font-medium text-verde-600">Admin</span>
        </div>
        <span className="font-lv-display text-meta font-semibold bg-verde-50 text-verde-600 px-[10px] py-[3px] rounded-full border border-verde-200 whitespace-nowrap max-sm:hidden">
          Panel de administración
        </span>
        <UserMenu />
        {/* Hamburger menu button - solo móvil */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden size-11 grid place-items-center rounded-full hover:bg-verde-50 transition-colors duration-500 ease-outquint text-ink-soft/75 hover:text-verde-600 shrink-0"
          aria-label="Abrir menú"
          aria-expanded={mobileMenuOpen}
        >
          <Menu size={20} strokeWidth={1.8} />
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
                  "relative flex items-center gap-gap-sm w-full px-gap-md py-3 rounded-full text-small font-medium transition-colors duration-500 ease-outquint text-left border-none bg-transparent cursor-pointer font-lv-display",
                  isActive
                    ? "text-verde-700 font-semibold"
                    : "text-ink-soft/75 hover:bg-sand",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="admin-nav-side"
                    className="absolute inset-0 rounded-full bg-verde-50"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon
                  size={20}
                  strokeWidth={1.8}
                  className="relative shrink-0 z-10"
                />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </aside>

        {/* Main Content */}
        <main id="content" className="flex-1 min-w-0 overflow-y-auto">
          {/* En móvil el aire se recorta a 12 px, como en el panel de negocio.
              Cada eje por su cuenta: el atajo `p-gap-*` también pone
              `padding-bottom` y, como las variantes responsive salen después en
              el CSS, se comía el hueco del dock de 640 px para arriba, donde el
              dock sigue visible (`lg:hidden`). */}
          <div className="px-gap-sm pt-gap-sm pb-dock-clear sm:px-gap-md sm:pt-gap-md lg:px-gap-xl lg:pt-gap-xl lg:pb-gap-xl flex flex-col min-h-full">
            {/* Sin `mode="wait"`: el mismo cambio que en el panel de negocio.
                Con la espera, cada navegación costaba 400 ms de salida más 400
                de entrada con la pantalla vacía en medio. */}
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="flex flex-col min-h-full"
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>

      {/* Cajón del móvil: el `Sheet` del sistema, el mismo que el panel de
          negocio. Trae `role="dialog"`, `aria-modal`, Escape, trampa de foco y
          la vuelta del foco al botón que lo abrió; antes nada de eso estaba y
          el menú era un callejón con teclado. */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-[320px] flex flex-col !p-0 !gap-0 lg:hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-ink/5">
            {/* `asChild` para conservar el `<span>`: el título del `Sheet` trae
                `text-h3` y aquí el rótulo es `text-body`, dos claves de la
                escala propia que `cn` no sabe desempatar. */}
            <SheetTitle asChild>
              <span className="font-lv-display text-body font-semibold text-ink">
                Secciones
              </span>
            </SheetTitle>
            <SheetClose
              className="size-11 grid place-items-center rounded-full hover:bg-ink/5 transition-colors text-ink-soft/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/30"
              aria-label="Cerrar menú"
            >
              <X size={20} strokeWidth={1.8} />
            </SheetClose>
          </div>
          <nav
            className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
            aria-label="Navegación de administración"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveItem(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium transition-colors duration-200 text-left",
                    isActive
                      ? "bg-verde-50 text-verde-700 font-semibold"
                      : "text-ink-soft/75 hover:bg-sand",
                  )}
                >
                  <Icon size={22} strokeWidth={1.8} className="shrink-0" />
                  <span>{item.label}</span>
                  {isActive && (
                    <ChevronRight
                      size={18}
                      strokeWidth={2}
                      className="ml-auto text-verde-600"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-ink/5">
            <p className="font-lv-display text-meta text-ink-soft/75 text-center">
              Panel de administración
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

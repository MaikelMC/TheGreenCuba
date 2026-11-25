"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ChevronRight,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MoreHorizontal,
  Send,
  Store,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/layout/user-menu";
import {
  MobileDock,
  type MobileDockItem,
} from "@/components/layout/mobile-dock";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ADMIN_NAV, esItemActivo, tituloDeSeccion } from "@/lib/admin-nav";
import type { AdminDelPanel } from "@/lib/admin-contadores";
import { useAdminContadores } from "./admin-contadores";

/**
 * El armazón del panel de administración.
 *
 * Escritorio: barra lateral agrupada por lo que se hace cada día, con contadores
 * reales al lado de las secciones que tienen cola, y los administradores abajo.
 * Móvil: barra superior con el título de la sección y un dock flotante con las
 * cuatro secciones de uso diario más «Más», que abre el resto agrupado igual.
 *
 * Los números salen de `AdminContadoresProvider`, que los recibe del layout en
 * la misma petición que ya consulta la base para el rol.
 */
export function AdminShell({
  children,
  usuarioId,
  admins,
}: {
  children: React.ReactNode;
  usuarioId: string;
  admins: AdminDelPanel[];
}) {
  const pathname = usePathname();
  const { contadores } = useAdminContadores();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const contenidoRef = useRef<HTMLElement>(null);

  const titulo = tituloDeSeccion(pathname);

  // Cerrar el cajón al navegar.
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  /* El scroll vive en `<main>`, no en la ventana, así que Next no lo toca al
     navegar: cada sección empieza arriba. */
  useEffect(() => {
    const main = contenidoRef.current;
    if (main) main.scrollTop = 0;
  }, [pathname]);

  /* Si la ventana crece de 1024 px, el cajón deja de existir y quedaría abierto
     e invisible, con la trampa de foco puesta sobre algo que no se ve. */
  useEffect(() => {
    if (!menuAbierto) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const cerrar = () => mq.matches && setMenuAbierto(false);
    mq.addEventListener("change", cerrar);
    return () => mq.removeEventListener("change", cerrar);
  }, [menuAbierto]);

  const badge = (valor?: number) =>
    valor && valor > 0 ? (valor > 99 ? "99+" : String(valor)) : null;

  const dockItems: MobileDockItem[] = [
    {
      key: "inicio",
      label: "Inicio",
      icon: LayoutDashboard,
      href: "/admin",
      active: pathname === "/admin",
      badge: contadores.pendientes || undefined,
      badgeLabel: "pendientes",
    },
    {
      key: "negocios",
      label: "Negocios",
      icon: Store,
      href: "/admin/negocios",
      active: pathname.startsWith("/admin/negocios"),
    },
    {
      key: "soporte",
      label: "Soporte",
      icon: LifeBuoy,
      href: "/admin/soporte",
      active: pathname.startsWith("/admin/soporte"),
      badge: contadores.conversaciones || undefined,
      badgeLabel: "conversaciones abiertas",
    },
    {
      key: "publicaciones",
      label: "Publicar",
      icon: Send,
      href: "/admin/publicaciones",
      active: pathname.startsWith("/admin/publicaciones"),
      badge: contadores.publicaciones || undefined,
      badgeLabel: "publicaciones por revisar",
    },
    {
      key: "mas",
      label: "Más",
      icon: MoreHorizontal,
      onSelect: () => setMenuAbierto(true),
    },
  ];

  return (
    <div className="admin-panel flex h-dvh flex-col bg-sand font-lv text-ink">
      {/* Barra superior: el título de la sección, no el nombre del sistema. */}
      <header className="safe-top sticky top-0 z-50 flex h-header shrink-0 items-center gap-2 border-b border-ink/5 bg-sand-warm/90 px-3 backdrop-blur-[16px] sm:gap-gap-sm sm:px-gap-md">
        <Link
          href="/home"
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-verde-50 hover:text-verde-600"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft/45">
            La Verde Admin
          </p>
          <p className="truncate font-lv-display text-body font-bold tracking-[-0.01em] text-ink">
            {titulo}
          </p>
        </div>
        <UserMenu />
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-verde-50 hover:text-verde-600 lg:hidden"
          aria-label="Abrir secciones"
          aria-expanded={menuAbierto}
        >
          <Menu size={20} strokeWidth={1.8} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Barra lateral de escritorio */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-ink/5 bg-white lg:flex">
          <div className="px-gap-md pb-gap-sm pt-gap-md">
            <Link
              href="/admin"
              className="font-lv-display text-body font-bold tracking-[-0.02em] text-ink"
            >
              La Verde <span className="font-medium text-verde-600">Admin</span>
            </Link>
          </div>
          <nav
            aria-label="Secciones de administración"
            className="scrollbar-fino flex-1 overflow-y-auto px-gap-sm pb-gap-md"
          >
            {ADMIN_NAV.map((grupo) => (
              <div key={grupo.titulo} className="mb-gap-sm">
                <p className="px-gap-md pb-[6px] pt-gap-xs font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft/45">
                  {grupo.titulo}
                </p>
                {grupo.items.map((item) => {
                  const Icon = item.icon;
                  const activo = esItemActivo(pathname, item);
                  const cuenta = item.contador
                    ? contadores[item.contador]
                    : undefined;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={activo ? "page" : undefined}
                      className={cn(
                        "relative flex w-full items-center gap-gap-sm rounded-full px-gap-md py-2.5 font-lv-display text-small transition-colors duration-500 ease-outquint",
                        activo
                          ? "font-semibold text-verde-700"
                          : "font-medium text-ink-soft/75 hover:bg-sand",
                      )}
                    >
                      {activo && (
                        <motion.span
                          layoutId="admin-nav-side"
                          className="absolute inset-0 rounded-full bg-verde-50"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 32,
                          }}
                        />
                      )}
                      <Icon
                        size={19}
                        strokeWidth={1.8}
                        className="relative z-10 shrink-0"
                      />
                      <span className="relative z-10 truncate">
                        {item.label}
                      </span>
                      {badge(cuenta) && (
                        <span
                          className={cn(
                            "relative z-10 ml-auto min-w-[20px] rounded-full border px-[6px] text-center font-lv-display text-[11px] font-bold leading-[18px]",
                            activo
                              ? "border-verde-200 bg-white text-verde-700"
                              : "border-verde-200 bg-verde-50 text-verde-700",
                          )}
                        >
                          {badge(cuenta)}
                          <span className="sr-only"> pendientes</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <PieAdministradores admins={admins} usuarioId={usuarioId} />
        </aside>

        {/* Contenido */}
        <main
          id="content"
          ref={contenidoRef}
          className="min-w-0 flex-1 overflow-y-auto"
        >
          <div className="flex min-h-full flex-col px-gap-sm pb-dock-clear pt-gap-sm sm:px-gap-md sm:pt-gap-md lg:px-gap-xl lg:pb-gap-xl lg:pt-gap-xl">
            <div key={pathname} className="lv-view-in flex min-h-full flex-col">
              {children}
            </div>
          </div>
        </main>
      </div>

      <MobileDock items={dockItems} label="Secciones de administración" />

      {/* «Más» y el botón de menú abren el mismo cajón con todo agrupado. */}
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetContent
          side="right"
          className="flex w-full max-w-[320px] flex-col !gap-0 !p-0 lg:hidden"
        >
          <div className="flex items-center justify-between border-b border-ink/5 p-4">
            <SheetTitle asChild>
              <span className="font-lv-display text-body font-semibold text-ink">
                Secciones
              </span>
            </SheetTitle>
            <SheetClose
              className="grid size-11 place-items-center rounded-full text-ink-soft/75 transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/30"
              aria-label="Cerrar secciones"
            >
              <X size={20} strokeWidth={1.8} />
            </SheetClose>
          </div>
          <nav
            aria-label="Secciones de administración"
            className="scrollbar-fino flex-1 overflow-y-auto px-4 py-4"
          >
            {ADMIN_NAV.map((grupo) => (
              <div key={grupo.titulo} className="mb-gap-sm">
                <p className="px-2 pb-[6px] pt-gap-xs font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft/45">
                  {grupo.titulo}
                </p>
                {grupo.items.map((item) => {
                  const Icon = item.icon;
                  const activo = esItemActivo(pathname, item);
                  const cuenta = item.contador
                    ? contadores[item.contador]
                    : undefined;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuAbierto(false)}
                      aria-current={activo ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition-colors duration-200",
                        activo
                          ? "bg-verde-50 font-semibold text-verde-700"
                          : "text-ink-soft/75 hover:bg-sand",
                      )}
                    >
                      <Icon size={21} strokeWidth={1.8} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {badge(cuenta) && (
                        <span className="ml-auto min-w-[22px] rounded-full border border-verde-200 bg-verde-50 px-[6px] text-center font-lv-display text-meta font-bold leading-[20px] text-verde-700">
                          {badge(cuenta)}
                        </span>
                      )}
                      {activo && !badge(cuenta) && (
                        <ChevronRight
                          size={18}
                          strokeWidth={2}
                          className="ml-auto shrink-0 text-verde-600"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="border-t border-ink/5 p-4">
            <PieAdministradores
              admins={admins}
              usuarioId={usuarioId}
              compacto
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Dos iniciales como mucho: el disco mide 32 px y un nombre largo no cabe. */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "·";
}

function PieAdministradores({
  admins,
  usuarioId,
  compacto = false,
}: {
  admins: AdminDelPanel[];
  usuarioId: string;
  compacto?: boolean;
}) {
  if (admins.length === 0) return null;

  return (
    <div className={cn(!compacto && "border-t border-ink/5 p-gap-sm")}>
      <p className="px-gap-xs pb-[6px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft/45">
        Administradores
      </p>
      {admins.map((admin) => (
        <div
          key={admin.id}
          className="flex items-center gap-gap-xs px-gap-xs py-1.5"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-verde-50 font-lv-display text-meta font-bold text-verde-700">
            {iniciales(admin.name)}
          </span>
          <span className="min-w-0 flex-1 truncate text-meta text-ink">
            {admin.name}
          </span>
          {admin.id === usuarioId && (
            <span className="rounded-full bg-verde-50 px-2 py-[1px] font-lv-display text-[10px] font-semibold text-verde-700">
              Tú
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

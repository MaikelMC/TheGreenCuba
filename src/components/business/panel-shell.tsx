"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Edit,
  LayoutDashboard,
  Megaphone,
  Menu,
  Settings,
  Sparkles,
  Tag,
  Utensils,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { UserMenu } from "@/components/layout/user-menu";
import { EASE } from "@/lib/motion";
import { puedeSalir } from "@/lib/unsaved-guard";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

export type PanelView =
  | "dashboard"
  | "catalogo"
  | "pedidos"
  | "editor"
  | "ofertas"
  | "publicaciones"
  | "planes"
  | "settings";

interface PanelShellProps {
  /**
   * El nombre que se lee en la barra lateral y en el pie del cajón.
   *
   * Es obligatorio y no se pide a `/api/me`: el armazón ya envuelve todas las
   * vistas del panel y el dueño puede estar mirando **otro** de sus negocios
   * —el selector viaja en `?negocio=`—, así que la sesión no sabe cuál está
   * abierto. Antes había aquí un `fetchMe` de respaldo que solo se usaba si el
   * prop faltaba, y nunca faltaba: una petición por montaje pagada en datos
   * móviles para un valor que llegaba siempre por props.
   */
  businessName: string;
  /**
   * Si la ficha está publicada, y solo entonces se enseña la pastilla.
   *
   * Decía «Negocio verificado», y era mentira por dos motivos: la verificación
   * no existe —lo único que hay detrás es que la ficha esté publicada— y
   * además el rótulo se pintaba siempre, incluso con la ficha sin publicar.
   * Ahora dice lo que de verdad sabe y, cuando no lo sabe, no dice nada.
   */
  publicado?: boolean;
  defaultView?: PanelView;
  /**
   * Contenido que va **encima de la vista**, en todas las secciones.
   *
   * Lo usa el selector de negocio: elegir qué negocio miras no es una sección
   * más, tiene que seguir a la vista —si estás editando la ficha y cambias de
   * negocio, sigues editando, pero la otra— y por eso no puede vivir dentro de
   * ninguna de ellas.
   */
  above?: React.ReactNode;
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
  { id: "catalogo", label: "Catálogo", icon: Utensils },
  { id: "pedidos", label: "Pedidos", icon: ClipboardList },
  { id: "editor", label: "Editar", icon: Edit },
  { id: "ofertas", label: "Ofertas", icon: Tag },
  { id: "publicaciones", label: "Publicar", icon: Megaphone },
  { id: "planes", label: "Planes", icon: Sparkles },
  { id: "settings", label: "Ajustes", icon: Settings },
];

export function PanelShell({
  businessName,
  publicado = false,
  defaultView = "dashboard",
  above,
  children,
  className,
}: PanelShellProps) {
  const [activeView, setActiveView] = useState<PanelView>(defaultView);
  /* El mismo cajón lateral que el panel de administración, en vez del dock
     inferior: dos armazones distintos para dos paneles hermanos se leían como
     dos productos. Aquí sigue habiendo una sola lista de secciones —el dock
     necesitaba rótulos cortos y la barra lateral largos— porque el cajón y la
     barra lateral caben con el mismo texto. */
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* La sección abierta se puede pedir desde la URL, como ya hace el perfil:
     sin esto, un enlace a «Ajustes» deja a quien llega en el dashboard
     buscando la pestaña a mano. Se lee de `window.location` y no con
     `useSearchParams`, que obligaría a envolver la página en un `Suspense` y a
     renunciar al HTML estático. Para leer un parámetro una vez al montar, no
     compensa. */
  useEffect(() => {
    const seccion = new URLSearchParams(window.location.search).get("seccion");
    if (seccion && NAV_ITEMS.some((item) => item.id === seccion)) {
      setActiveView(seccion as PanelView);
    }
  }, []);

  /* Cambiar de sección no navega —es la misma página—, pero sí actualiza la URL:
     así una sección se puede compartir y el botón «atrás» no devuelve a un sitio
     distinto del que se está viendo. `replaceState` y no `pushState`, para que
     pasar por tres pestañas no deje tres pasos en el historial.
     Y no vale un `<Link>` con `?seccion=`: cada clic dispararía un render de
     servidor con sus tres oleadas de consultas, justo lo que este armazón evita
     desde el principio. */
  const go = (view: PanelView) => {
    /* La pantalla que se está dejando puede tener trabajo sin guardar —el
       catálogo, sobre todo— y ella es la única que sabe qué se pierde. Si su
       guardia dice que no, no se cambia de sección: `puedeSalir()` ya se ha
       encargado de preguntar. */
    if (view !== activeView && !puedeSalir()) return;
    setActiveView(view);
    setDrawerOpen(false);

    const url = new URL(window.location.href);
    if (view === defaultView) url.searchParams.delete("seccion");
    else url.searchParams.set("seccion", view);
    window.history.replaceState(null, "", url);
  };

  /* De 1024 px para arriba el cajón no existe: las secciones son la barra
     lateral. Si la ventana crece con él abierto —girar el móvil, ensanchar la
     ventana— hay que cerrarlo, porque si no quedaría un diálogo invisible con
     la trampa de foco puesta: el teclado se quedaría dentro de algo que no se
     ve. Se comprueba con `matchMedia` y no con un ancho leído a mano para que
     el corte sea exactamente el mismo que el de `lg`. */
  useEffect(() => {
    if (!drawerOpen) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const cerrar = () => mq.matches && setDrawerOpen(false);
    mq.addEventListener("change", cerrar);
    return () => mq.removeEventListener("change", cerrar);
  }, [drawerOpen]);

  return (
    <div className={cn("business-panel h-dvh bg-sand font-lv text-ink flex flex-col", className)}>
      {/* Top Bar. Igual que la cabecera del home: barra clara translúcida con
          hairline de tinta, no el `border-border` gris del sistema viejo. */}
      <header className="sticky top-0 z-50 bg-sand-warm/90 backdrop-blur-[16px] border-b border-ink/5 h-header flex items-center px-3 gap-2 sm:px-gap-md sm:gap-gap-sm shrink-0">
        <Link
          href="/home"
          /* Salir del panel también pasa por la guardia: es la misma pérdida de
             trabajo que cambiar de sección, solo que por otra puerta. */
          onClick={(e) => {
            if (!puedeSalir()) e.preventDefault();
          }}
          className="size-11 grid place-items-center rounded-full hover:bg-verde-50 transition-colors duration-500 ease-outquint text-ink-soft/75 hover:text-verde-600 shrink-0"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </Link>
        <div className="font-lv-display font-bold text-[18px] text-ink tracking-[-0.02em] whitespace-nowrap">
          <span translate="no">La Verde</span>{" "}
          <span className="font-medium text-verde-600">Panel</span>
        </div>
        <div className="flex-1 min-w-0" />
        {publicado && (
          <span className="font-lv-display text-meta font-semibold bg-verde-50 text-verde-600 px-[10px] py-[3px] rounded-full border border-verde-200 whitespace-nowrap max-sm:hidden">
            Publicado en La Verde
          </span>
        )}
        {/* Sin `initial` fijo: la inicial la saca el menú del nombre de la sesión. */}
        <UserMenu />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="lg:hidden size-11 grid place-items-center rounded-full hover:bg-verde-50 transition-colors duration-500 ease-outquint text-ink-soft/75 hover:text-verde-600 shrink-0"
          aria-label="Abrir menú"
          aria-expanded={drawerOpen}
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
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-gap-sm w-full px-gap-md py-3 rounded-full text-small font-medium transition-colors duration-500 ease-outquint text-left border-none bg-transparent cursor-pointer font-lv-display",
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
            <div className="font-lv-display text-small font-bold text-ink">{businessName}</div>
            <div className="flex items-center gap-[6px] text-meta text-ink-soft/75">
              <span className="size-[6px] rounded-full bg-verde-400" />
              Activo en La Verde
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* En móvil el aire se recorta a 12 px, como en la cabecera del home.
              Con los 16 px de escritorio más los 16 de cada `FormSection` se
              iban 64 px de los 360 de pantalla, y las filas de horarios no
              cabían.
              Cada eje por su cuenta en vez del atajo `p-gap-*`: el atajo pone
              también `padding-bottom`, y como las variantes responsive salen
              después en el CSS, el valor de móvil se comía el de `lg`. */}
          <div className="px-gap-sm pt-gap-sm pb-gap-md sm:px-gap-md sm:pt-gap-md lg:px-gap-xl lg:pt-gap-xl lg:pb-gap-xl flex flex-col min-h-full">
            {above}
            {/* Sin `AnimatePresence` y sin `mode="wait"`: con la espera, la
                vista nueva no se montaba hasta que la vieja terminaba de salir,
                y cada cambio de sección costaba 400 ms de salida más 400 de
                entrada mirando al vacío. Ahora React desmonta la anterior de
                golpe y esta entra fundiéndose en 180 ms. La clave se queda: la
                vista cambia de verdad. */}
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="flex flex-col min-h-full"
            >
              {children(activeView, go)}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Cajón lateral (móvil). Es el `Sheet` del sistema —Radix Dialog por
          debajo— y no un div con clases a mano: así trae `role="dialog"`,
          `aria-modal`, cierre con Escape, trampa de foco, foco al primer
          enlace al abrir y vuelta al botón de la hamburguesa al cerrar. El
          que había antes no tenía nada de eso: con teclado o lector de
          pantalla, el menú del móvil era un callejón sin salida.
          Va montado siempre y se abre con `open`: Radix se encarga del
          portal, del bloqueo del scroll de detrás y de desmontarlo al cerrar. */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-[320px] flex flex-col !p-0 !gap-0 lg:hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-ink/5">
            {/* `asChild` para quedarse con el `<span>`: el título de `Sheet`
                trae `text-h3` y aquí el rótulo es `text-body`, y `cn` no
                sabe desempatar dos claves de la escala propia del proyecto. */}
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
            aria-label="Secciones del panel"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-medium transition-colors duration-200 text-left cursor-pointer",
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
                </button>
              );
            })}
          </nav>
          <div className="p-4 border-t border-ink/5">
            <p className="font-lv-display text-meta text-ink-soft/75 text-center">
              {businessName}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

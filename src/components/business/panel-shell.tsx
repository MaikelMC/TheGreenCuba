"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Home,
  MessageCircle,
  MoonStar,
  Store,
  SunMedium,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import { UserMenu, type EntradaMenu } from "@/components/layout/user-menu";
import { MobileDock } from "@/components/layout/mobile-dock";
import { puedeSalir } from "@/lib/unsaved-guard";
import { whatsappHref } from "@/lib/contact-links";
import { SUPPORT_WHATSAPP } from "@/lib/legal";
import { BotonIcono } from "./ui/botones";
import { HojaPanel } from "./ui/hoja-panel";
import { ListaNegocios, type NegocioPanel } from "./business-switcher";
import { PendientesProvider, usePedidosPendientes } from "./pedidos-pendientes";
import {
  COOKIE_ULTIMA,
  INICIO,
  claveDestino,
  conUltima,
  esPrincipal,
  leerDestino,
  leerHoja,
  mismoDestino,
  padreDe,
  tituloDe,
  type Destino,
  type HojaId,
} from "./panel-nav";

export type { PanelView, Destino } from "./panel-nav";

/** Un destino de la barra lateral o del dock. */
export interface ItemNav {
  destino: Destino;
  label: string;
  icon: LucideIcon;
}

/* ── Navegación del panel ────────────────────────────────────────────────────
   La URL manda: `?seccion=` y `&sub=` dicen la pantalla, `&hoja=` la hoja
   abierta. Cada cambio de pantalla y cada hoja que se abre añaden una entrada
   al historial, así que el atrás de Android y del navegador cierra la hoja o
   vuelve a la pantalla anterior sin salir del panel. Es la misma página: nada
   de esto pide un render al servidor. */

interface PanelNav {
  destino: Destino;
  hoja: HojaId | null;
  /** Ir a otra pantalla. Pasa por la guardia de trabajo sin guardar. */
  ir: (destino: Destino, extras?: Record<string, string>) => void;
  /** La flecha de las subpantallas: vuelve a la de origen. */
  volver: () => void;
  abrirHoja: (hoja: HojaId) => void;
  cerrarHoja: () => void;
  /** Si esta cuenta puede abrir ese destino (permisos de trabajador). */
  puedeAbrir: (destino: Destino) => boolean;
}

const NavCtx = createContext<PanelNav | null>(null);

export function usePanelNav(): PanelNav {
  const nav = useContext(NavCtx);
  if (!nav) throw new Error("usePanelNav fuera de PanelShell");
  return nav;
}

/**
 * La URL de un destino, partiendo de la actual (conserva `negocio`).
 * `extras` añade parámetros que lee la pantalla de destino y que ella misma
 * quita al usarlos (`&producto=` para Publicar, `&pedido=` del push).
 */
function urlCon(
  destino: Destino,
  hoja: HojaId | null,
  extras?: Record<string, string>,
): string {
  const url = new URL(window.location.href);
  if (destino.seccion === "dashboard" && !destino.sub) url.searchParams.delete("seccion");
  else url.searchParams.set("seccion", destino.seccion);
  if (destino.sub) url.searchParams.set("sub", destino.sub);
  else url.searchParams.delete("sub");
  if (hoja) url.searchParams.set("hoja", hoja);
  else url.searchParams.delete("hoja");
  /* `ultima` solo sirve en la primera carga, tras el acceso. */
  url.searchParams.delete("ultima");
  for (const [clave, valor] of Object.entries(extras ?? {})) url.searchParams.set(clave, valor);
  return `${url.pathname}${url.search}${url.hash}`;
}

function leerCookie(nombre: string): string | null {
  const fila = document.cookie.split("; ").find((c) => c.startsWith(`${nombre}=`));
  return fila ? fila.slice(nombre.length + 1) : null;
}

interface PanelShellProps {
  negocioId: string;
  /** El nombre de la barra. Sale de la ficha que se está viendo. */
  businessName: string;
  logoUrl?: string | null;
  /** Si la ficha está publicada: decide el texto de la tarjeta lateral. */
  publicado: boolean;
  /** Los negocios de la cuenta. Con dos o más, el nombre abre «Tus negocios». */
  negocios: NegocioPanel[];
  /** La pantalla que pide la URL, leída en el servidor. */
  destinoInicial: Destino;
  puedeAbrir: (destino: Destino) => boolean;
  /** Las pestañas del dock (móvil). Ver la regla en `business-panel.tsx`. */
  dock: ItemNav[];
  /** La barra lateral (escritorio): arriba las principales, debajo los grupos. */
  lateral: ItemNav[];
  grupos: { titulo: string; items: ItemNav[] }[];
  /** La píldora de estado, bajo el nombre. */
  estado: ReactNode;
  /**
   * Si se vigilan los pedidos nuevos desde el armazón (permiso `pedidos` y
   * función `whatsapp_pedido`): contador, título de la pestaña y sonido.
   */
  vigilarPedidos: boolean;
  /** Hojas que dependen de la navegación y se montan dentro del armazón. */
  hojas?: ReactNode;
  children: (destino: Destino) => ReactNode;
}

export function PanelShell({
  negocioId,
  businessName,
  logoUrl,
  publicado,
  negocios,
  destinoInicial,
  puedeAbrir,
  dock,
  lateral,
  grupos,
  estado,
  vigilarPedidos,
  hojas,
  children,
}: PanelShellProps) {
  const router = useRouter();
  const valido = (d: Destino) => (puedeAbrir(d) ? d : INICIO);
  const [destino, setDestino] = useState<Destino>(() => valido(destinoInicial));
  const [hoja, setHoja] = useState<HojaId | null>(null);
  const destinoRef = useRef(destino);
  const hojaRef = useRef(hoja);
  destinoRef.current = destino;
  hojaRef.current = hoja;
  const contenidoRef = useRef<HTMLDivElement>(null);

  const guardarUltima = useCallback(
    (d: Destino) => {
      try {
        const valor = conUltima(leerCookie(COOKIE_ULTIMA), negocioId, d);
        document.cookie = `${COOKIE_ULTIMA}=${valor}; path=/business; max-age=31536000; samesite=lax`;
      } catch {
        /* Sin cookies, se entra en Hoy: no se pierde nada más. */
      }
    },
    [negocioId],
  );

  /* Al cambiar de negocio la página llega con otras props: se adopta la
     pantalla que pide la URL nueva (o Hoy, si en ese negocio no se puede). */
  const negocioPrevio = useRef(negocioId);
  useEffect(() => {
    if (negocioPrevio.current === negocioId) return;
    negocioPrevio.current = negocioId;
    setDestino(valido(destinoInicial));
    setHoja(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId]);

  /* Al montar: la URL queda en su forma canónica (`settings` ya es `mas`, se
     quita `ultima`), se abre la hoja si el enlace la pedía y se anota la
     sección como la última usada. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const h = leerHoja(params.get("hoja"));
    window.history.replaceState(window.history.state, "", urlCon(destinoRef.current, h));
    if (h) setHoja(h);
    guardarUltima(destinoRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ir = useCallback(
    (d: Destino, extras?: Record<string, string>) => {
      if (!puedeAbrir(d)) return;
      const cambia = !mismoDestino(d, destinoRef.current);
      if (!cambia && !hojaRef.current) return;
      if (cambia && !puedeSalir()) return;
      window.history.pushState({ lv: true }, "", urlCon(d, null, extras));
      setDestino(d);
      setHoja(null);
      if (cambia) guardarUltima(d);
    },
    [puedeAbrir, guardarUltima],
  );

  const volver = useCallback(() => {
    /* Con una entrada propia detrás, el atrás vuelve a la pantalla de origen
       (si se llegó desde Hoy, a Hoy). Entrando por un enlace directo no hay
       nada propio detrás: se sube a la pantalla madre. */
    if ((window.history.state as { lv?: boolean } | null)?.lv) {
      window.history.back();
      return;
    }
    ir(padreDe(destinoRef.current));
  }, [ir]);

  const abrirHoja = useCallback((h: HojaId) => {
    window.history.pushState({ lv: true, hoja: h }, "", urlCon(destinoRef.current, h));
    setHoja(h);
  }, []);

  const cerrarHoja = useCallback(() => {
    const actual = hojaRef.current;
    if (!actual) return;
    if ((window.history.state as { hoja?: string } | null)?.hoja === actual) {
      window.history.back();
      return;
    }
    window.history.replaceState(window.history.state, "", urlCon(destinoRef.current, null));
    setHoja(null);
  }, []);

  /* El atrás del sistema. `popstate` no se puede cancelar: si hay trabajo sin
     guardar y la guardia dice que no, se vuelve a empujar la entrada en la que
     se estaba, y la pantalla no se mueve. Cerrar una hoja no pregunta. */
  useEffect(() => {
    function alVolver() {
      const params = new URLSearchParams(window.location.search);
      const d = valido(leerDestino(params.get("seccion"), params.get("sub")));
      const h = leerHoja(params.get("hoja"));
      const cambia = !mismoDestino(d, destinoRef.current);
      if (cambia && !puedeSalir()) {
        window.history.pushState(
          { lv: true, ...(hojaRef.current ? { hoja: hojaRef.current } : {}) },
          "",
          urlCon(destinoRef.current, hojaRef.current),
        );
        return;
      }
      setDestino(d);
      setHoja(h);
      if (cambia) guardarUltima(d);
    }
    window.addEventListener("popstate", alVolver);
    return () => window.removeEventListener("popstate", alVolver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardarUltima]);

  /* El scroll vive en el contenedor de la vista, no en la ventana: al cambiar
     de pantalla o de negocio se vuelve arriba. */
  useEffect(() => {
    const contenido = contenidoRef.current;
    if (contenido) contenido.scrollTop = 0;
  }, [destino, negocioId]);

  /* Qué se marca en la barra: el destino exacto si está en la lista; si no, la
     pantalla madre (Editar mi ficha marca «Más» en el dock). */
  const marcado = (items: ItemNav[]) => {
    const exacto = items.find((i) => mismoDestino(i.destino, destino));
    return claveDestino(exacto ? exacto.destino : padreDe(destino));
  };
  const marcadoLateral = marcado([...lateral, ...grupos.flatMap((g) => g.items)]);
  const marcadoDock = marcado(dock);

  const nav: PanelNav = { destino, hoja, ir, volver, abrirHoja, cerrarHoja, puedeAbrir };

  const variosNegocios = negocios.length > 1;
  const extras = useEntradasMenu(negocioId, variosNegocios ? () => abrirHoja("negocios") : null);
  const principal = esPrincipal(destino);

  return (
    <NavCtx.Provider value={nav}>
      <PendientesProvider
        key={negocioId}
        placeId={negocioId}
        activo={vigilarPedidos}
        enPedidos={esPedidos(destino)}
        onVerPedidos={() => ir({ seccion: "pedidos", sub: null })}
      >
      <div className="business-panel flex h-dvh flex-col bg-sand font-lv text-ink">
        {/* Barra superior: el negocio (con su estado debajo) a la izquierda y la
            cuenta a la derecha. «Volver al inicio» pasó al menú de la cuenta
            como «Ir a La Verde», y «Publicado en La Verde» a la pantalla Hoy. */}
        <header className="safe-top sticky top-0 z-50 flex h-header shrink-0 items-center gap-gap-xs border-b border-ink/5 bg-sand-warm/90 px-3 backdrop-blur-[16px] sm:gap-gap-sm sm:px-gap-md">
          <Marca nombre={businessName} logoUrl={logoUrl} />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-[2px]">
            {variosNegocios ? (
              <button
                type="button"
                onClick={() => abrirHoja("negocios")}
                aria-label={`${businessName}. Cambiar de negocio`}
                className="relative inline-flex max-w-full cursor-pointer items-center gap-[4px] rounded-full font-lv-display text-small font-bold leading-tight text-ink transition-colors duration-500 ease-outquint after:absolute after:inset-x-0 after:-top-[7px] after:bottom-0 after:content-[''] hover:text-verde-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
              >
                <span className="truncate">{businessName}</span>
                <ChevronDown size={14} strokeWidth={2} aria-hidden className="shrink-0" />
              </button>
            ) : (
              <span className="max-w-full truncate font-lv-display text-small font-bold leading-tight text-ink">
                {businessName}
              </span>
            )}
            {estado}
          </div>
          <UserMenu extras={extras} antesDeSalir={puedeSalir} />
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Escritorio: la barra lateral. Arriba las pantallas principales y
              debajo los grupos de «Más», para llegar a todo en un toque. */}
          <nav
            aria-label="Secciones del panel"
            className="scrollbar-fino hidden w-[260px] shrink-0 flex-col gap-[2px] overflow-y-auto border-r border-ink/5 bg-white px-gap-sm pt-gap-md lg:flex"
          >
            {lateral.map((item) => (
              <BotonLateral
                key={claveDestino(item.destino)}
                item={item}
                activo={marcadoLateral === claveDestino(item.destino)}
                onClick={() => ir(item.destino)}
              />
            ))}
            {grupos.map(
              (grupo) =>
                grupo.items.length > 0 && (
                  <div key={grupo.titulo} className="flex flex-col gap-[2px]">
                    <p className="px-gap-md pb-[2px] pt-gap-md font-lv-display text-meta font-semibold text-ink-soft/60">
                      {grupo.titulo}
                    </p>
                    {grupo.items.map((item) => (
                      <BotonLateral
                        key={claveDestino(item.destino)}
                        item={item}
                        tenue
                        activo={marcadoLateral === claveDestino(item.destino)}
                        onClick={() => ir(item.destino)}
                      />
                    ))}
                  </div>
                ),
            )}

            <div className="mx-gap-sm mb-gap-md mt-auto flex flex-col gap-gap-xs rounded-2xl border border-ink/5 bg-sand p-gap-md">
              <div className="font-lv-display text-small font-bold text-ink">{businessName}</div>
              <div className="flex items-center gap-[6px] text-meta text-ink-soft/75">
                <span
                  className={clsx(
                    "size-[6px] rounded-full",
                    publicado ? "bg-verde-400" : "bg-ink/15",
                  )}
                />
                {publicado ? "Activo en La Verde" : "Sin publicar"}
              </div>
            </div>
          </nav>

          <div ref={contenidoRef} className="scrollbar-fino min-w-0 flex-1 overflow-y-auto">
            {/* En móvil el aire se recorta a 12 px; abajo deja el hueco del dock
                (`pb-dock-clear`), para que el último elemento no quede tapado.
                Cada eje por su cuenta en vez del atajo `p-gap-*`: el atajo pone
                también `padding-bottom` y el valor de móvil se comía el de `lg`. */}
            <div className="flex min-h-full flex-col px-gap-sm pb-dock-clear pt-gap-sm sm:px-gap-md sm:pt-gap-md lg:px-gap-xl lg:pb-gap-xl lg:pt-gap-xl">
              {!principal && (
                <div className="mb-gap-md flex items-center gap-gap-xs">
                  <BotonIcono
                    aria-label="Volver"
                    onClick={volver}
                    className="-ml-[10px]"
                  >
                    <ArrowLeft size={20} strokeWidth={1.8} />
                  </BotonIcono>
                  <h1 className="min-w-0 font-lv-display text-h3 font-bold text-ink">
                    {tituloDe(destino)}
                  </h1>
                </div>
              )}
              {/* La animación va por CSS y no con `motion`: el `initial` de
                  `motion` viajaba en el HTML del servidor como `opacity: 0`, y en
                  una conexión lenta la sección se quedaba en blanco. */}
              <div key={claveDestino(destino)} className="lv-view-in flex min-h-full flex-col">
                {children(destino)}
              </div>
            </div>
          </div>
        </div>

        {/* Móvil y tablet: el mismo dock flotante que el perfil y los proyectos.
            Sustituye a la hamburguesa y al cajón lateral. */}
        <DockPanel dock={dock} marcado={marcadoDock} ir={ir} />

        {variosNegocios && (
          <HojaPanel
            open={hoja === "negocios"}
            onOpenChange={(open) => {
              if (!open) cerrarHoja();
            }}
            titulo="Tus negocios"
          >
            <ListaNegocios
              negocios={negocios}
              seleccionado={negocioId}
              destino={destino}
              onCerrar={cerrarHoja}
            />
          </HojaPanel>
        )}
        {hojas}
      </div>
      </PendientesProvider>
    </NavCtx.Provider>
  );
}

const esPedidos = (d: Destino) => d.seccion === "pedidos" && d.sub === null;

/** El contador de pedidos pendientes junto a «Pedidos» en la barra lateral. */
function ContadorPedidos({ destino }: { destino: Destino }) {
  const { pendientes } = usePedidosPendientes();
  if (!esPedidos(destino) || !pendientes) return null;
  return (
    <span className="relative z-10 ml-auto min-w-[22px] rounded-full bg-verde-400 px-[7px] py-[1px] text-center font-lv-display text-meta font-bold text-verde-950">
      {pendientes > 99 ? "99+" : pendientes}
      <span className="sr-only"> pendientes</span>
    </span>
  );
}

/** El dock, con el contador de pedidos pendientes sobre «Pedidos». */
function DockPanel({
  dock,
  marcado,
  ir,
}: {
  dock: ItemNav[];
  marcado: string;
  ir: (d: Destino) => void;
}) {
  const { pendientes } = usePedidosPendientes();
  return (
    <MobileDock
      label="Secciones del panel"
      items={dock.map((item) => ({
        key: claveDestino(item.destino),
        label: item.label,
        icon: item.icon,
        active: marcado === claveDestino(item.destino),
        onSelect: () => ir(item.destino),
        badge: esPedidos(item.destino) ? (pendientes ?? undefined) : undefined,
        badgeLabel: "pendientes",
      }))}
    />
  );
}

/** El logo del negocio o su inicial, en un disco de 36 px. */
function Marca({ nombre, logoUrl }: { nombre: string; logoUrl?: string | null }) {
  if (logoUrl) {
    return (
      <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-ink/5 bg-white">
        <Image src={logoUrl} alt="" fill sizes="36px" quality={70} className="object-cover" />
      </span>
    );
  }
  const inicial = nombre.trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-full bg-verde-50 font-lv-display text-small font-bold text-verde-700"
    >
      {inicial || <Store size={18} strokeWidth={1.8} />}
    </span>
  );
}

function BotonLateral({
  item,
  activo,
  tenue = false,
  onClick,
}: {
  item: ItemNav;
  activo: boolean;
  tenue?: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activo ? "page" : undefined}
      className={clsx(
        "relative flex w-full cursor-pointer items-center gap-gap-sm rounded-full border-none bg-transparent px-gap-md py-3 text-left font-lv-display text-small font-medium transition-colors duration-500 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
        activo
          ? "font-semibold text-verde-700"
          : clsx(tenue ? "text-ink-soft/55" : "text-ink-soft/75", "hover:bg-sand"),
      )}
    >
      {activo && (
        <motion.span
          layoutId="panel-nav-side"
          className="absolute inset-0 rounded-full bg-verde-50"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <Icon size={20} strokeWidth={1.8} className="relative z-10 shrink-0" />
      <span className="relative z-10">{item.label}</span>
      <ContadorPedidos destino={item.destino} />
    </button>
  );
}

/**
 * Las entradas del panel en el menú de la cuenta: «Ir a La Verde» (pasa por la
 * guardia), «Ver mi ficha», cambiar de negocio, el tema —dentro del panel no
 * había conmutador— y el soporte. «Cerrar sesión» ya lo trae el menú.
 */
function useEntradasMenu(negocioId: string, cambiarNegocio: (() => void) | null): EntradaMenu[] {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  /* En el servidor `resolvedTheme` no existe: sin la guarda, el primer render
     del cliente pintaría el rótulo contrario al del HTML. */
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const oscuro = montado && resolvedTheme === "dark";

  return [
    {
      key: "ir-la-verde",
      label: "Ir a La Verde",
      icon: Home,
      onSelect: () => {
        if (puedeSalir()) router.push("/home");
      },
    },
    { key: "ficha", label: "Ver mi ficha", icon: ExternalLink, href: `/place/${negocioId}` },
    ...(cambiarNegocio
      ? [{ key: "negocios", label: "Cambiar de negocio", icon: Store, onSelect: cambiarNegocio }]
      : []),
    {
      key: "tema",
      label: oscuro ? "Modo claro" : "Modo oscuro",
      icon: oscuro ? SunMedium : MoonStar,
      onSelect: () => setTheme(oscuro ? "light" : "dark"),
    },
    {
      key: "soporte",
      label: "Soporte por WhatsApp",
      icon: MessageCircle,
      href: whatsappHref(SUPPORT_WHATSAPP),
    },
  ];
}

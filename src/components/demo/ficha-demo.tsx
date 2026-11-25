"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChevronRight, Facebook, Globe, Instagram, Moon, ShoppingCart, Sun } from "lucide-react";
import { iconoDeProducto } from "@/lib/ficha/iconos-producto";
import { convertirPrecio, type MonedaVista } from "@/lib/precios";

/**
 * Ficha demo estilo Facebook. Diseño fijo (no depende del tema de la app):
 * paleta propia en estilos en línea, para que se vea igual en cualquier
 * dispositivo y sea fácil de compartir con el negocio.
 *
 * Tiene dos paletas con los tokens reales del sistema —clara y oscura— y el
 * botón de sol/luna de la portada cambia entre ellas. Arranca en oscuro, que es
 * como se comparte la demo.
 *
 * Toda la data entra por props desde el servidor (`/demo/yoyi`), que la lee de
 * la base. Aquí solo va la interacción: pestañas, carrito y pedido por WhatsApp.
 */

export interface FichaDemoData {
  name: string;
  city: string;
  address: string;
  schedule: string;
  whatsapp: string;
  logoUrl: string;
  intro: string;
  tiempo: string;
  fotos: string[];
  productos: {
    id: string;
    name: string;
    desc: string;
    cat: string;
    precio: number;
    /** Foto del producto. Sin ella, el hueco lleva el icono sugerente. */
    image?: string | null;
  }[];
  agotados: string[];
  categorias: string[];
  pagos: string[];
  tienePlanta: boolean;
  servicios: string[];
  /** Sitio web y redes. `href: null` = dato de ejemplo, no abre nada. */
  redes: { red: "web" | "instagram" | "facebook"; texto: string; href: string | null }[];
  /** Las redes son de ejemplo: el negocio todavía no rellenó las suyas. */
  redesEjemplo: boolean;
  /** Monedas a las que se puede pasar la carta (incluye siempre "CUP"). */
  monedas: string[];
  /** La tasa usada no es la del negocio, sino la de referencia del catálogo. */
  tasaReferencia: boolean;
  tasa: {
    tasaUsdCup: number;
    tasaRedondeo: number;
    tasaEurCup: number | null;
    tasaMlcCup: number | null;
    transferenciaPct: number | null;
  } | null;
  fidelidad: {
    nombre: string;
    metas: { sellos: number; premio: string }[];
    compraMinima: { monto: number; moneda: string } | null;
  } | null;
}

/**
 * Las dos paletas de la ficha, con los tokens reales del sistema
 * (`tailwind.config.ts` y la sección de dark mode de `DESIGN.md`). El botón de
 * sol/luna alterna entre ellas sin tocar el tema de la app: la demo es una
 * página aparte y se enseña con el modo que se quiera.
 */
interface Paleta {
  page: string;
  card: string;
  ink: string;
  soft: string;
  line: string;
  line2: string;
  chipBg: string;
  green50: string;
  green200: string;
  green: string;
  red: string;
  halo: string;
  accent: string;
  accentInk: string;
  sombraLogo: string;
}

const PALETA_CLARA: Paleta = {
  page: "#FBF9F4", // sand-warm, el fondo de la ficha real
  card: "#FFFFFF", // superficie
  ink: "#08130D", // ink
  soft: "rgba(27,42,33,0.75)", // ink-soft/75
  line: "rgba(8,19,13,0.08)", // separadores: entre border-ink/5 y /10
  line2: "rgba(8,19,13,0.16)", // border-ink/15
  chipBg: "#EAE4D6", // sand-deep
  green50: "#EAF7EF", // verde-50
  green200: "#9FDDB9", // verde-200
  green: "#0C6136", // verde-700: texto de acento sobre sand o blanco
  red: "#8A2F1F",
  halo: "0 18px 40px -12px rgba(53,175,109,0.6)", // shadow-primary-halo
  accent: "#35AF6D", // verde-400
  accentInk: "#052017", // verde-950
  sombraLogo: "0 0 0 1px rgba(8,19,13,0.08), 0 12px 28px -10px rgba(8,19,13,0.28)",
};

const PALETA_OSCURA: Paleta = {
  page: "#08130d", // fondo de página oscuro
  card: "#0e1720", // superficie oscura
  ink: "#edf7f0", // texto claro
  soft: "rgba(237,247,240,0.75)",
  line: "rgba(237,247,240,0.10)",
  line2: "rgba(237,247,240,0.16)",
  chipBg: "#16212b", // superficie elevada
  green50: "#173522", // verde-50 oscuro
  green200: "#28533a", // borde verde oscuro (entre verde-100 y verde-200)
  green: "#9be3b4", // verde de acento oscuro
  red: "#ffb4ae",
  halo: "0 18px 40px -12px rgba(53,175,109,0.6)",
  accent: "#35AF6D",
  accentInk: "#052017",
  sombraLogo: "0 0 0 1px rgba(237,247,240,0.16), 0 12px 28px -10px rgba(0,0,0,0.6)",
};

/**
 * El tema activo, para los componentes pequeños (`Chip`, `MiniaturaProducto`)
 * que no reciben la paleta por props. El valor por defecto es el oscuro, que es
 * como se comparte la demo.
 */
const TemaCtx = createContext<Paleta>(PALETA_OSCURA);
const useTema = () => useContext(TemaCtx);

const DISPLAY = "'Space Grotesk', system-ui, sans-serif";

const nf = new Intl.NumberFormat("es-ES");
const fmt = (n: number) => nf.format(n).replace(/\./g, " ") + " CUP";

function Icon({ d, fill = false, size = 20 }: { d: ReactNode; fill?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {d}
    </svg>
  );
}

const ICON = {
  back: <path d="M15 18l-6-6 6-6" />,
  fwd: <path d="M9 18l6-6-6-6" />,
  share: (
    <>
      <path d="M15 5l6 6-6 6" />
      <path d="M21 11H11a7 7 0 0 0-7 7v1" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </>
  ),
  bag: (
    <>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  wa: <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  truck: (
    <>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6h2l3 11.5" />
      <path d="M5.5 17.5L9 9h6l-3 8.5" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </>
  ),
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  sello: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
};

/** Estilos base de la ficha, resueltos con la paleta del modo activo. */
function estilos(T: Paleta) {
  return {
    round: (bg: string, border?: string): CSSProperties => ({
      width: 44,
      height: 44,
      borderRadius: 999,
      border: border ? `1px solid ${border}` : "none",
      background: bg,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    }),
    card: (): CSSProperties => ({
      background: T.card,
      border: `1px solid ${T.line}`,
      borderRadius: 16,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }),
    h2: (): CSSProperties => ({ margin: 0, fontSize: 20, fontWeight: 600, fontFamily: DISPLAY }),
    h3: (): CSSProperties => ({ margin: 0, fontSize: 16, fontWeight: 600, fontFamily: DISPLAY }),
    link: (): CSSProperties => ({
      minHeight: 44,
      padding: "0 4px",
      border: "none",
      background: "transparent",
      color: T.green,
      fontFamily: DISPLAY,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
    }),
  };
}

function Chip({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  const T = useTema();
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${strong ? T.green200 : T.line2}`,
        background: strong ? T.green50 : T.chipBg,
        color: strong ? T.green : T.soft,
        fontFamily: DISPLAY,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function Photo({ url, style }: { url: string; style: CSSProperties }) {
  return (
    <div
      style={{
        ...style,
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  );
}

/**
 * La foto de un producto o, si no la tiene, el mismo hueco con icono sugerente
 * de la ficha real: un café no se parece a una pizza. El icono se elige por el
 * nombre con `iconoDeProducto`, compartido con la carta pública, para que la
 * demo no invente una segunda lista de palabras.
 */
function MiniaturaProducto({
  nombre,
  image,
  width,
  height,
  radius = 0,
  iconSize = 30,
}: {
  nombre: string;
  image?: string | null;
  width: number | string;
  height: number;
  radius?: number;
  iconSize?: number;
}) {
  const T = useTema();
  const base: CSSProperties = { width, height, borderRadius: radius, flexShrink: 0 };
  if (image) {
    return (
      <div
        aria-hidden
        style={{
          ...base,
          backgroundImage: `url(${image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    );
  }
  const Icono = iconoDeProducto(nombre);
  return (
    <div
      aria-hidden
      style={{
        ...base,
        background: T.green50,
        color: T.green,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icono size={iconSize} strokeWidth={1.5} style={{ opacity: 0.85 }} />
    </div>
  );
}

const RED = {
  web: { label: "Sitio web", Icono: Globe },
  instagram: { label: "Instagram", Icono: Instagram },
  facebook: { label: "Facebook", Icono: Facebook },
} as const;

const TABS: [string, string][] = [
  ["todo", "Todo"],
  ["menu", "Menú"],
  ["fotos", "Fotos"],
  ["resenas", "Reseñas"],
  ["info", "Información"],
];

export function FichaDemo({ data }: { data: FichaDemoData }) {
  const [tab, setTab] = useState("todo");
  const [cat, setCat] = useState("Todas");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [introOpen, setIntroOpen] = useState(false);
  const [showAgot, setShowAgot] = useState(false);
  const [menuPage, setMenuPage] = useState(0);
  const [foto, setFoto] = useState(0);
  const [moneda, setMoneda] = useState("CUP");
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /* Arranca en oscuro, que es como se comparte la demo; el botón de la portada
     cambia a claro sin tocar el tema de la app. */
  const [modo, setModo] = useState<"oscuro" | "claro">("oscuro");
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const T = modo === "claro" ? PALETA_CLARA : PALETA_OSCURA;
  const s = estilos(T);

  /* Precio en la moneda elegida, con la tasa del negocio (como la carta real).
     CUP, o sin tasa, se muestra tal cual; el resto se convierte. */
  const config = data.tasa ? { ...data.tasa, tasaActualizadaEn: null } : null;
  const precioFmt = (cup: number) => {
    if (moneda === "CUP" || !config) return fmt(cup);
    const conv = convertirPrecio(String(cup), "CUP", moneda as MonedaVista, config);
    return conv == null ? fmt(cup) : `${conv} ${moneda}`;
  };

  const goPage = (delta: number) => {
    const el = carouselRef.current;
    if (el) el.scrollBy({ left: delta * (el.clientWidth || 1), behavior: "smooth" });
  };
  const arrow = (dis: boolean): CSSProperties => ({
    width: 36,
    height: 36,
    borderRadius: 999,
    border: `1px solid ${T.line2}`,
    background: T.card,
    color: dis ? T.soft : T.ink,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: dis ? "default" : "pointer",
    opacity: dis ? 0.4 : 1,
  });
  const add = (id: string, d: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + d) }));

  let cuenta = 0;
  let total = 0;
  for (const p of data.productos) {
    const q = qty[p.id] || 0;
    cuenta += q;
    total += q * p.precio;
  }

  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aviso = (m: string) => {
    if (toastT.current) clearTimeout(toastT.current);
    setSheet(false);
    setToast(m);
    toastT.current = setTimeout(() => setToast(null), 3200);
  };

  const enviarPedido = () => {
    const items = data.productos
      .filter((p) => (qty[p.id] ?? 0) > 0)
      .map((p) => `${qty[p.id] ?? 0} x ${p.name} (${fmt(p.precio * (qty[p.id] ?? 0))})`);
    const texto = `Hola ${data.name}, quiero pedir:\n${items.join("\n")}\n\nTotal: ${fmt(total)}`;
    window.open(`https://wa.me/${data.whatsapp}?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const introCorta = data.intro.replace(/\s+/g, " ").slice(0, 96).trim() + "…";
  const lista = data.productos.filter((p) => cat === "Todas" || p.cat === cat);

  const resumenRow = (icon: ReactNode, body: ReactNode) => (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, color: T.soft }}>
        <Icon d={icon} size={22} />
      </span>
      <div style={{ fontSize: 15, lineHeight: 1.4 }}>{body}</div>
    </div>
  );

  /* Enlace real si hay `href`; si es de ejemplo, un botón que solo avisa. */
  const enlaceRed = (r: FichaDemoData["redes"][number], style: CSSProperties, children: ReactNode, aria?: string) =>
    r.href ? (
      <a key={r.red} href={r.href} target="_blank" rel="noopener noreferrer" aria-label={aria} style={{ ...style, textDecoration: "none" }}>
        {children}
      </a>
    ) : (
      <button key={r.red} type="button" onClick={() => aviso(`Abriría su ${RED[r.red].label}`)} aria-label={aria} style={{ ...style, cursor: "pointer" }}>
        {children}
      </button>
    );

  return (
    <TemaCtx.Provider value={T}>
    <div style={{ minHeight: "100dvh", background: T.page, color: T.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 440, margin: "0 auto", position: "relative", paddingBottom: cuenta > 0 ? 96 : 24 }}>
        {/* Portada: carrusel de fotos, se pasan con el dedo */}
        <div
          role="group"
          aria-label="Fotos del negocio"
          onScroll={(e) => {
            const w = e.currentTarget.clientWidth || 1;
            setFoto(Math.round(e.currentTarget.scrollLeft / w));
          }}
          style={{ display: "flex", width: "100%", minWidth: 0, maxWidth: "100%", height: 210, overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } as CSSProperties}
        >
          {(data.fotos.length > 0 ? data.fotos : [""]).map((u, i) => (
            <div key={i} style={{ flex: "0 0 100%", width: "100%", maxWidth: "100%", minWidth: 0, height: 210, scrollSnapAlign: "start", backgroundColor: "#6B4A2B" }}>
              <Photo url={u} style={{ width: "100%", height: "100%" } as CSSProperties} />
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", top: 14, left: 14 }}>
          <button onClick={() => history.back()} aria-label="Volver" style={s.round("rgba(8,19,13,0.55)")}>
            <Icon d={ICON.back} />
          </button>
        </div>
        <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 8 }}>
          <button
            onClick={() => setModo((m) => (m === "oscuro" ? "claro" : "oscuro"))}
            aria-label={modo === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            aria-pressed={modo === "claro"}
            style={s.round("rgba(8,19,13,0.55)")}
          >
            {modo === "oscuro" ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
          </button>
          <button onClick={() => aviso("Enlace de la ficha copiado")} aria-label="Compartir" style={s.round("rgba(8,19,13,0.55)")}>
            <Icon d={ICON.share} />
          </button>
          <button onClick={() => setSheet(true)} aria-label="Más acciones" style={s.round("rgba(8,19,13,0.55)")}>
            <Icon d={ICON.dots} fill />
          </button>
        </div>
        {data.fotos.length > 0 && (
          <button
            onClick={() => setTab("fotos")}
            style={{ position: "absolute", top: 196, right: 14, height: 32, padding: "0 12px", borderRadius: 999, border: "none", background: "rgba(8,19,13,0.55)", color: "#fff", fontFamily: DISPLAY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {Math.min(foto + 1, data.fotos.length)} / {data.fotos.length} fotos
          </button>
        )}

        {/* Cabecera */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px", textAlign: "center" }}>
          <Photo
            url={data.logoUrl}
            style={{ width: 112, height: 112, marginTop: -56, borderRadius: "50%", border: `4px solid ${T.page}`, backgroundColor: "#3B2A1E", position: "relative", zIndex: 2, boxShadow: T.sombraLogo } as CSSProperties}
          />
          <h1 style={{ margin: "12px 0 0", fontSize: 28, fontWeight: 600, letterSpacing: "-0.4px", fontFamily: DISPLAY }}>{data.name}</h1>
          <div style={{ marginTop: 2, fontSize: 14, color: T.soft }}>Comida a domicilio · {data.city}</div>
          {data.schedule && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: T.green }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent }} />
              Abierto · {data.schedule}
            </div>
          )}
          <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.5, maxWidth: 330, whiteSpace: "pre-line" }}>
            {introOpen ? data.intro : introCorta}
          </p>
          <button onClick={() => setIntroOpen((v) => !v)} style={{ marginTop: 2, minHeight: 36, padding: "0 8px", border: "none", background: "transparent", color: T.soft, fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {introOpen ? "Ver menos" : "Ver más"}
          </button>
        </div>

        {/* Acciones */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) 48px", gap: 8, padding: "10px 16px 0" }}>
          <button onClick={() => setTab("menu")} style={{ height: 48, borderRadius: 999, border: "none", background: T.accent, color: T.accentInk, boxShadow: T.halo, fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
            <Icon d={ICON.bag} size={18} />
            Pedir
          </button>
          <a href={`https://wa.me/${data.whatsapp}`} target="_blank" rel="noopener noreferrer" style={{ height: 48, borderRadius: 999, border: `1px solid ${T.line2}`, background: T.card, color: T.ink, fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", textDecoration: "none" }}>
            <Icon d={ICON.wa} size={18} />
            WhatsApp
          </a>
          <button onClick={() => setSheet(true)} aria-label="Más acciones" style={{ height: 48, borderRadius: 999, border: `1px solid ${T.line2}`, background: T.card, color: T.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Icon d={ICON.dots} fill />
          </button>
        </div>

        {/* Pestañas */}
        <div style={{ position: "sticky", top: 0, zIndex: 4, marginTop: 16, background: T.page, borderBottom: `1px solid ${T.line}` }}>
          <div role="tablist" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 16px", scrollbarWidth: "none" }}>
            {TABS.map(([k, label]) => {
              const sel = tab === k;
              return (
                <button
                  key={k}
                  role="tab"
                  aria-selected={sel}
                  onClick={() => {
                    setTab(k);
                    setShowAgot(false);
                  }}
                  style={{ flexShrink: 0, height: 40, padding: "0 16px", borderRadius: 999, border: "none", background: sel ? T.green50 : "transparent", color: sel ? T.green : T.soft, fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== TODO ===== */}
        {tab === "todo" && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...s.card(), gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={s.h2()}>Resumen</h2>
                <button onClick={() => setTab("info")} style={s.link()}>Ver todo</button>
              </div>
              {resumenRow(ICON.clock, <><b style={{ color: T.green, fontWeight: 600 }}>Abierto ahora</b> · {data.schedule}</>)}
              {resumenRow(ICON.pin, data.address)}
              {resumenRow(ICON.truck, `A domicilio en ${data.tiempo} · envío a consultar por WhatsApp`)}
              {data.pagos.length > 0 && resumenRow(ICON.card, `Aceptan ${data.pagos.join(", ")}`)}
              {data.tienePlanta && resumenRow(ICON.bolt, "Tiene planta: funciona sin corriente")}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 2 }}>
                {data.servicios.map((sv) => (
                  <Chip key={sv}>{sv}</Chip>
                ))}
              </div>
              {data.redes.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
                  <span style={{ flex: 1, fontSize: 14, color: T.soft }}>Síguelos</span>
                  {data.redes.map((r) => {
                    const { label, Icono } = RED[r.red];
                    return enlaceRed(
                      r,
                      { width: 44, height: 44, borderRadius: 999, border: `1px solid ${T.line2}`, background: T.card, color: T.ink, display: "flex", alignItems: "center", justifyContent: "center" },
                      <Icono size={20} strokeWidth={1.8} />,
                      label,
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={s.h2()}>Del menú</h2>
                <button onClick={() => setTab("menu")} style={s.link()}>Ver menú</button>
              </div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", margin: "0 -16px", padding: "0 16px", scrollbarWidth: "none" }}>
                {data.productos.slice(0, 8).map((p) => (
                  <div key={p.id} style={{ flexShrink: 0, width: 150, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <MiniaturaProducto nombre={p.name} image={p.image} width="100%" height={104} iconSize={38} />
                    <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: T.soft }}>{precioFmt(p.precio)}</div>
                      <button onClick={() => add(p.id, 1)} style={{ marginTop: 4, height: 36, borderRadius: 999, border: `1px solid ${T.green200}`, background: T.green50, color: T.green, fontFamily: DISPLAY, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <ShoppingCart size={14} strokeWidth={2} />
                        {(qty[p.id] ?? 0) > 0 ? `En tu pedido · ${qty[p.id] ?? 0}` : "Añadir"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={s.h2()}>Fotos</h2>
                <button onClick={() => setTab("fotos")} style={s.link()}>Ver las {data.fotos.length}</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 4, borderRadius: 16, overflow: "hidden" }}>
                {data.fotos.slice(0, 6).map((u, i) => (
                  <Photo key={i} url={u} style={{ aspectRatio: "1", backgroundColor: "#5a3f27" } as CSSProperties} />
                ))}
              </div>
            </div>

            <div style={s.card()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={s.h2()}>Reseñas</h2>
                <button onClick={() => aviso("Se abriría el formulario de reseña")} style={{ height: 40, padding: "0 16px", borderRadius: 999, border: `1px solid ${T.line2}`, background: T.card, color: T.ink, fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Opinar</button>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Todavía no hay reseñas</div>
              <div style={{ fontSize: 14, color: T.soft }}>Cuéntale a los demás cómo te pareció este lugar.</div>
            </div>
          </div>
        )}

        {/* ===== MENÚ ===== */}
        {tab === "menu" && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <h2 style={s.h2()}>Menú</h2>
              <span style={{ fontSize: 12, color: T.soft }}>{data.productos.length} disponibles</span>
            </div>
            {data.monedas.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: T.soft }}>Precios en</span>
                <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 999, background: T.chipBg, border: `1px solid ${T.line}` }}>
                  {data.monedas.map((m) => {
                    const sel = moneda === m;
                    return (
                      <button key={m} onClick={() => setMoneda(m)} aria-pressed={sel} style={{ height: 28, padding: "0 12px", borderRadius: 999, border: "none", background: sel ? T.green50 : "transparent", color: sel ? T.green : T.soft, fontFamily: DISPLAY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {m}
                      </button>
                    );
                  })}
                </div>
                {data.tasaReferencia && moneda !== "CUP" && (
                  <span style={{ fontSize: 11, color: T.soft }}>tasa de referencia</span>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "0 -16px", padding: "0 16px", scrollbarWidth: "none" }}>
              {["Todas", ...data.categorias].map((c) => {
                const sel = cat === c;
                return (
                  <button key={c} onClick={() => { setCat(c); setMenuPage(0); }} style={{ flexShrink: 0, height: 40, padding: "0 16px", borderRadius: 999, border: `1px solid ${sel ? T.green200 : T.line2}`, background: sel ? T.green50 : T.card, color: sel ? T.green : T.ink, fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    {c}
                  </button>
                );
              })}
            </div>
            {lista.length === 0 ? (
              <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: "18px 14px", fontSize: 14, color: T.soft }}>Hoy no queda nada de esta categoría.</div>
            ) : (
              (() => {
                /* Paginación deslizante: 8 productos por página, se cambia de página
                   deslizando a los lados (scroll-snap horizontal). */
                const paginas: Array<typeof lista> = [];
                for (let i = 0; i < lista.length; i += 8) paginas.push(lista.slice(i, i + 8));
                return (
                  <>
                    <div
                      key={cat}
                      ref={carouselRef}
                      onScroll={(e) => {
                        const w = e.currentTarget.clientWidth || 1;
                        setMenuPage(Math.round(e.currentTarget.scrollLeft / w));
                      }}
                      style={{ display: "flex", width: "100%", minWidth: 0, maxWidth: "100%", overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } as CSSProperties}
                    >
                      {paginas.map((pg, pi) => (
                        /* `minWidth: 0` es lo que hace que la página se quede en el
                           ancho del móvil: sin él, el mínimo automático de un ítem
                           flex lo marcan los textos con `nowrap` de cada producto
                           y la página crece hacia la derecha, dejando el botón de
                           añadir fuera de la pantalla. */
                        <div key={pi} style={{ flex: "0 0 100%", width: "100%", maxWidth: "100%", minWidth: 0, scrollSnapAlign: "start", boxSizing: "border-box" }}>
                          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, display: "flex", flexDirection: "column", minWidth: 0 }}>
                            {pg.map((p, i) => {
                              const q = qty[p.id] || 0;
                              return (
                                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, padding: "12px 14px", borderBottom: i === pg.length - 1 ? "none" : `1px solid ${T.line}` }}>
                                  <MiniaturaProducto nombre={p.name} image={p.image} width={56} height={56} radius={12} iconSize={26} />
                                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                                    <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                                    <div style={{ fontSize: 13, color: T.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc || p.cat}</div>
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>{precioFmt(p.precio)}</div>
                                  </div>
                                  {q === 0 ? (
                                    /* Carrito y la palabra «Añadir», como la ficha real: el «+»
                                       suelto no decía a dónde iba el producto. */
                                    <button onClick={() => add(p.id, 1)} aria-label={`Añadir ${p.name} al pedido`} style={{ height: 44, padding: "0 14px", flexShrink: 0, borderRadius: 999, border: "none", background: T.accent, color: T.accentInk, fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                      <ShoppingCart size={17} strokeWidth={2} />
                                      Añadir
                                    </button>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, padding: 2, borderRadius: 999, background: T.green50 }}>
                                      <button onClick={() => add(p.id, -1)} aria-label={`Quitar uno de ${p.name}`} style={{ width: 40, height: 40, borderRadius: 999, border: "none", background: T.card, color: T.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                        <Icon d={ICON.minus} size={18} />
                                      </button>
                                      <span style={{ minWidth: 18, textAlign: "center", fontWeight: 700 }}>{q}</span>
                                      <button onClick={() => add(p.id, 1)} aria-label={`Añadir otro ${p.name}`} style={{ width: 40, height: 40, borderRadius: 999, border: "none", background: T.accent, color: T.accentInk, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                        <Icon d={ICON.plus} size={18} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {paginas.length > 1 && (
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, paddingTop: 4 }}>
                        <button onClick={() => goPage(-1)} disabled={menuPage === 0} aria-label="Página anterior" style={arrow(menuPage === 0)}>
                          <Icon d={ICON.back} size={18} />
                        </button>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {paginas.map((_, i) => (
                            <span key={i} style={{ width: i === menuPage ? 20 : 7, height: 7, borderRadius: 999, background: i === menuPage ? T.green : T.line2, transition: "width .2s ease" }} />
                          ))}
                        </div>
                        <button onClick={() => goPage(1)} disabled={menuPage === paginas.length - 1} aria-label="Página siguiente" style={arrow(menuPage === paginas.length - 1)}>
                          <Icon d={ICON.fwd} size={18} />
                        </button>
                      </div>
                    )}
                  </>
                );
              })()
            )}

            {data.agotados.length > 0 && (
              <>
                <button onClick={() => setShowAgot((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 48, padding: "0 14px", borderRadius: 16, border: `1px solid ${T.line}`, background: T.card, color: T.ink, fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  <span>Agotado por hoy · {data.agotados.length}</span>
                  <span style={{ color: T.soft }}>{showAgot ? "Ocultar" : "Ver"}</span>
                </button>
                {showAgot && (
                  <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, display: "flex", flexDirection: "column", opacity: 0.65 }}>
                    {data.agotados.slice(0, 8).map((n, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${T.line}` }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{n}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.red }}>Agotado</span>
                      </div>
                    ))}
                    {data.agotados.length > 8 && (
                      <div style={{ padding: "12px 14px", fontSize: 13, color: T.soft }}>y {data.agotados.length - 8} productos más</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ===== FOTOS ===== */}
        {tab === "fotos" && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={s.h2()}>Fotos</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 4, borderRadius: 16, overflow: "hidden" }}>
              {data.fotos.map((u, i) => (
                <Photo key={i} url={u} style={{ aspectRatio: "1", backgroundColor: "#5a3f27" } as CSSProperties} />
              ))}
            </div>
          </div>
        )}

        {/* ===== RESEÑAS ===== */}
        {tab === "resenas" && (
          <div style={{ padding: 16 }}>
            <div style={{ ...s.card(), padding: "24px 16px", alignItems: "center", textAlign: "center", gap: 10 }}>
              <span style={{ color: T.green }}>
                <Icon d={ICON.star} size={32} />
              </span>
              <div style={{ fontSize: 17, fontWeight: 600 }}>Todavía no hay reseñas</div>
              <div style={{ fontSize: 14, color: T.soft, maxWidth: 260 }}>Sé el primero en contar cómo te fue con {data.name}.</div>
              <button onClick={() => aviso("Se abriría el formulario de reseña")} style={{ marginTop: 6, height: 48, padding: "0 24px", borderRadius: 999, border: "none", background: T.accent, color: T.accentInk, boxShadow: T.halo, fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Escribir una reseña</button>
            </div>
          </div>
        )}

        {/* ===== INFO ===== */}
        {tab === "info" && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={s.card()}>
              <h3 style={s.h3()}>Ubicación</h3>
              <div style={{ height: 120, borderRadius: 12, background: T.chipBg, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.soft, fontSize: 13, fontWeight: 600 }}>Mapa del lugar</div>
              <div style={{ fontSize: 15, lineHeight: 1.4 }}>{data.address}</div>
              <button onClick={() => aviso("Se abriría el mapa con la ruta")} style={{ height: 44, borderRadius: 999, border: `1px solid ${T.line2}`, background: T.card, color: T.ink, fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cómo llegar</button>
            </div>
            <div style={{ ...s.card(), gap: 8 }}>
              <h3 style={s.h3()}>Horario</h3>
              <div style={{ fontSize: 15 }}><b style={{ color: T.green, fontWeight: 600 }}>Abierto ahora</b> · {data.schedule}</div>
            </div>
            <div style={s.card()}>
              <h3 style={s.h3()}>Pedidos a domicilio</h3>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: T.soft }}>Tiempo</span><span style={{ fontWeight: 600 }}>{data.tiempo}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ color: T.soft }}>Envío</span><span style={{ fontWeight: 600 }}>A consultar por WhatsApp</span></div>
            </div>
            {data.fidelidad && (
              <div style={s.card()}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: T.green }}>
                    <Icon d={ICON.sello} size={20} />
                  </span>
                  <h3 style={s.h3()}>{data.fidelidad.nombre}</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.fidelidad.metas.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
                      <span style={{ color: T.soft }}>{m.sellos} sellos</span>
                      <span style={{ fontWeight: 600 }}>{m.premio}</span>
                    </div>
                  ))}
                </div>
                {data.fidelidad.compraMinima && (
                  <div style={{ fontSize: 13, color: T.soft }}>
                    Un sello por cada compra desde {fmt(data.fidelidad.compraMinima.monto).replace(" CUP", "")} {data.fidelidad.compraMinima.moneda}.
                  </div>
                )}
              </div>
            )}
            <div style={s.card()}>
              <h3 style={s.h3()}>Contacto</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={`https://wa.me/${data.whatsapp}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, height: 44, borderRadius: 999, border: `1px solid ${T.line2}`, background: T.card, color: T.ink, fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>WhatsApp</a>
                <a href={`tel:+${data.whatsapp}`} style={{ flex: 1, height: 44, borderRadius: 999, border: `1px solid ${T.line2}`, background: T.card, color: T.ink, fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Llamar</a>
              </div>
            </div>
            {data.redes.length > 0 && (
              <div style={{ ...s.card(), gap: 0, paddingBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 4 }}>
                  <h3 style={s.h3()}>Redes y sitio web</h3>
                  {data.redesEjemplo && <Chip>Ejemplo</Chip>}
                </div>
                {data.redes.map((r, i) => {
                  const { label, Icono } = RED[r.red];
                  return enlaceRed(
                    r,
                    { display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: 0, border: "none", borderTop: i === 0 ? "none" : `1px solid ${T.line}`, background: "transparent", color: T.ink, textAlign: "left", width: "100%", font: "inherit" },
                    <>
                      <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 999, background: T.green50, color: T.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icono size={20} strokeWidth={1.8} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 13, color: T.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.texto}</span>
                      </span>
                      <ChevronRight size={18} strokeWidth={1.8} style={{ color: T.soft, flexShrink: 0 }} />
                    </>,
                  );
                })}
              </div>
            )}
            <div style={s.card()}>
              <h3 style={s.h3()}>Pagos y servicios</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {data.pagos.map((p, i) => (
                  <Chip key={p} strong={i === 0}>{p}</Chip>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {data.servicios.map((sv) => (
                  <Chip key={sv}>{sv}</Chip>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra del pedido */}
      {cuenta > 0 && (
        <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 16, width: "min(100% - 24px, 416px)", zIndex: 6 }}>
          <button onClick={enviarPedido} style={{ width: "100%", height: 56, padding: "0 8px 0 20px", borderRadius: 999, border: "none", background: T.accent, color: T.accentInk, boxShadow: T.halo, fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <span>Ver pedido · {cuenta === 1 ? "1 producto" : `${cuenta} productos`}</span>
            <span style={{ height: 40, padding: "0 14px", borderRadius: 999, background: "rgba(5,32,23,0.12)", display: "flex", alignItems: "center" }}>{precioFmt(total)}</span>
          </button>
        </div>
      )}

      {/* Hoja de acciones */}
      {sheet && (
        <div style={{ position: "fixed", inset: 0, zIndex: 20 }}>
          <button onClick={() => setSheet(false)} aria-label="Cerrar" style={{ position: "absolute", inset: 0, border: "none", background: "rgba(8,19,13,0.42)", cursor: "pointer" }} />
          <div role="dialog" aria-label="Más acciones" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 0, width: "min(100%, 440px)", background: T.card, borderRadius: "24px 24px 0 0", padding: "10px 16px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ width: 40, height: 5, borderRadius: 999, background: T.line2, alignSelf: "center", marginBottom: 8 }} />
            {([
              ["Cómo llegar", "Se abriría el mapa con la ruta"],
              ["Guardar en mis lugares", "Guardado en tus lugares"],
              ["Avísame de sus ofertas", "Te avisaremos de sus novedades"],
              ["Compartir", "Enlace de la ficha copiado"],
            ] as [string, string][]).map(([label, msg]) => (
              <button key={label} onClick={() => aviso(msg)} style={{ display: "flex", alignItems: "center", minHeight: 52, padding: "0 8px", border: "none", borderRadius: 12, background: "transparent", color: T.ink, fontSize: 15, fontWeight: 600, textAlign: "left", cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Aviso */}
      {toast && (
        /* Como el toaster de la app: pastilla oscura y texto blanco en los dos
           temas, no un color de superficie que cambia con el modo. */
        <div role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: cuenta > 0 ? 84 : 16, width: "min(100% - 24px, 416px)", minHeight: 48, padding: "10px 16px", borderRadius: 14, background: "#08130D", color: "#FFFFFF", border: "1px solid rgba(237,247,240,0.16)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", zIndex: 30 }}>{toast}</div>
      )}
    </div>
    </TemaCtx.Provider>
  );
}

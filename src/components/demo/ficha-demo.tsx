"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Ficha demo estilo Facebook, modo oscuro. Diseño fijo (no depende del tema de
 * la app): paleta oscura propia en estilos en línea, para que se vea igual en
 * cualquier dispositivo y sea fácil de compartir con el negocio.
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
  productos: { id: string; name: string; desc: string; cat: string; precio: number }[];
  agotados: string[];
  categorias: string[];
  pagos: string[];
  tienePlanta: boolean;
  servicios: string[];
  fidelidad: {
    nombre: string;
    metas: { sellos: number; premio: string }[];
    compraMinima: { monto: number; moneda: string } | null;
  } | null;
}

const T = {
  page: "#08130d",
  card: "#0e1720",
  ink: "#edf7f0",
  soft: "rgba(237,247,240,0.78)",
  line: "rgba(237,247,240,0.10)",
  line2: "rgba(237,247,240,0.16)",
  chipBg: "#16212b",
  green50: "#173522",
  green200: "#28533a",
  green: "#9be3b4",
  red: "#ffb4ae",
  halo: "0 18px 40px -16px rgba(53,175,109,0.45)",
  accent: "#35AF6D",
  accentInk: "#052017",
};
const TILES = ["#5a3f27", "#6b4a2b", "#4d3a2a", "#7a5534", "#5e4630", "#694f36"];
const DISPLAY = "'Space Grotesk', system-ui, sans-serif";

const nf = new Intl.NumberFormat("es-ES");
const fmt = (n: number) => nf.format(n).replace(/\./g, " ") + " CUP";
const tile = (i: number) => TILES[i % TILES.length];

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

const s = {
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

function Chip({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
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
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const idx = Object.fromEntries(data.productos.map((p, i) => [p.id, i]));
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

  return (
    <div style={{ minHeight: "100dvh", background: T.page, color: T.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 440, margin: "0 auto", position: "relative", paddingBottom: cuenta > 0 ? 96 : 24 }}>
        {/* Portada */}
        <Photo
          url={data.fotos[0] ?? ""}
          style={{ position: "relative", height: 210, backgroundColor: "#6B4A2B" } as CSSProperties}
        />
        <div style={{ position: "absolute", top: 14, left: 14 }}>
          <button onClick={() => history.back()} aria-label="Volver" style={s.round("rgba(8,19,13,0.55)")}>
            <Icon d={ICON.back} />
          </button>
        </div>
        <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 8 }}>
          <button onClick={() => aviso("Enlace de la ficha copiado")} aria-label="Compartir" style={s.round("rgba(8,19,13,0.55)")}>
            <Icon d={ICON.share} />
          </button>
          <button onClick={() => setSheet(true)} aria-label="Más acciones" style={s.round("rgba(8,19,13,0.55)")}>
            <Icon d={ICON.dots} fill />
          </button>
        </div>
        <button
          onClick={() => setTab("fotos")}
          style={{ position: "absolute", top: 196, right: 14, height: 32, padding: "0 12px", borderRadius: 999, border: "none", background: "rgba(8,19,13,0.55)", color: "#fff", fontFamily: DISPLAY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          1 / {data.fotos.length} fotos
        </button>

        {/* Cabecera */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px", textAlign: "center" }}>
          <Photo
            url={data.logoUrl}
            style={{ width: 112, height: 112, marginTop: -56, borderRadius: "50%", border: `4px solid ${T.page}`, backgroundColor: "#3B2A1E" } as CSSProperties}
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
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={s.h2()}>Del menú</h2>
                <button onClick={() => setTab("menu")} style={s.link()}>Ver menú</button>
              </div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", margin: "0 -16px", padding: "0 16px", scrollbarWidth: "none" }}>
                {data.productos.slice(0, 8).map((p, i) => (
                  <div key={p.id} style={{ flexShrink: 0, width: 150, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ height: 104, background: tile(i) }} />
                    <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: T.soft }}>{fmt(p.precio)}</div>
                      <button onClick={() => add(p.id, 1)} style={{ marginTop: 4, height: 36, borderRadius: 999, border: `1px solid ${T.green200}`, background: T.green50, color: T.green, fontFamily: DISPLAY, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
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
            <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "0 -16px", padding: "0 16px", scrollbarWidth: "none" }}>
              {["Todas", ...data.categorias].map((c) => {
                const sel = cat === c;
                return (
                  <button key={c} onClick={() => setCat(c)} style={{ flexShrink: 0, height: 40, padding: "0 16px", borderRadius: 999, border: `1px solid ${sel ? T.green200 : T.line2}`, background: sel ? T.green50 : T.card, color: sel ? T.green : T.ink, fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    {c}
                  </button>
                );
              })}
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, display: "flex", flexDirection: "column" }}>
              {lista.length === 0 && (
                <div style={{ padding: "18px 14px", fontSize: 14, color: T.soft }}>Hoy no queda nada de esta categoría.</div>
              )}
              {lista.map((p, i) => {
                const q = qty[p.id] || 0;
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i === lista.length - 1 ? "none" : `1px solid ${T.line}` }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, background: tile(idx[p.id] ?? i), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: T.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc || p.cat}</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(p.precio)}</div>
                    </div>
                    {q === 0 ? (
                      <button onClick={() => add(p.id, 1)} aria-label={`Añadir ${p.name}`} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 999, border: "none", background: T.accent, color: T.accentInk, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <Icon d={ICON.plus} size={20} />
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
            <h2 style={s.h2()}>Fotos · El local</h2>
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
            <span style={{ height: 40, padding: "0 14px", borderRadius: 999, background: "rgba(5,32,23,0.12)", display: "flex", alignItems: "center" }}>{fmt(total)}</span>
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
        <div role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: cuenta > 0 ? 84 : 16, width: "min(100% - 24px, 416px)", minHeight: 48, padding: "10px 16px", borderRadius: 14, background: T.chipBg, color: T.ink, border: `1px solid ${T.line2}`, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", zIndex: 30 }}>{toast}</div>
      )}
    </div>
  );
}

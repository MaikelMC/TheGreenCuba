"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Bookmark,
  Eye,
  MousePointerClick,
  RefreshCw,
  Route,
  Share2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/admin/category-icon";
import { StateView } from "@/components/ui/state-view";

/**
 * "Negocios top": el ranking de interacción real que mide la base
 * (`place_metrics`), no una estimación. Cada gesto del visitante suma: ver la
 * ficha, tocar el pin, pedir ruta, que la IA lo recomiende, guardarlo o
 * compartirlo — con pesos distintos según la intención que implican.
 *
 * Filtra por provincia y categoría, y se recarga a mano: es una vista de
 * control, no un widget vivo, y así no golpea la API en cada render.
 *
 * Sigue el lenguaje del resto del panel: mismos selects que `BusinessList`
 * (42 px, anillo de foco verde), iconos de categoría en su caja verde, píldoras
 * de conteo como la distribución del dashboard, y estados de carga, vacío y
 * error con la forma real de la lista — el armazón anticipa el layout.
 */

interface TopPlace {
  id: string;
  name: string;
  category: string | null;
  province: string | null;
  city: string | null;
  boosted: boolean;
  plan: "trial" | "paid" | null;
  views: number;
  mapClicks: number;
  routeRequests: number;
  aiMatches: number;
  saves: number;
  shares: number;
  score: number;
}

interface TopPlacesApi {
  places: TopPlace[];
  categories: { value: string; label: string; icon: string | null }[];
  provinces: string[];
}

/* Mismo select que la lista de negocios: 42 px de alto, anillo de foco del
   sistema y cursor de puntero. El filtro del ranking no puede verse distinto
   al de la pantalla de al lado. */
const FILTER =
  "h-[42px] px-3 rounded-xl border border-ink/10 bg-white font-lv-display text-small text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20 cursor-pointer";

/* Acción de icono del panel: redonda y de 44 px en móvil, donde no hay
   puntero; 36 px a partir de `sm`, como los botones de fila de negocio. */
const ICON_BTN =
  "size-11 sm:size-9 rounded-full border grid place-items-center shrink-0 transition-colors duration-500 ease-outquint";

/* Las seis métricas de la fila, con su icono y su nombre largo para el
   `aria-label`: el número solo, sin leyenda, no lo dice nadie. */
const METRICS = [
  { key: "views", label: "Vistas de la ficha", icon: Eye },
  {
    key: "mapClicks",
    label: "Clicks en el pin del mapa",
    icon: MousePointerClick,
  },
  { key: "routeRequests", label: "Rutas pedidas", icon: Route },
  { key: "aiMatches", label: "Recomendaciones de la IA", icon: Sparkles },
  { key: "saves", label: "Guardados", icon: Bookmark },
  { key: "shares", label: "Compartidos", icon: Share2 },
] as const;

export function TopPlaces() {
  const [data, setData] = useState<TopPlacesApi | null>(null);
  const [rows, setRows] = useState<TopPlace[]>([]);
  const [province, setProvince] = useState("all");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /* El ranking se pliega: tres filas por defecto y un botón que abre el
     resto, para que veinte posiciones no se coman el dashboard. */
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (province !== "all") params.set("province", province);
      if (category !== "all") params.set("category", category);
      const res = await fetch(`/api/admin/top-places?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as TopPlacesApi;
      setData(json);
      setRows(json.places);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [province, category]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md">
      <div className="flex items-center gap-2 sm:items-start sm:flex-col sm:gap-4 mb-2 sm:mb-0">
        <h3 className="font-lv-display text-body font-semibold text-ink flex items-center gap-[6px]">
          <Trophy size={16} strokeWidth={1.8} className="text-verde-600" />
          Negocios top
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Actualizar ranking"
            className="p-1 rounded-full border border-ink/10 hover:bg-verde-50 hover:text-verde-600 transition-colors duration-200"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.8}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-gap-sm w-full">
        <select
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          aria-label="Filtrar ranking por provincia"
          className="flex-1 min-w-[120px] h-11 sm:h-[42px] px-3 rounded-xl border border-ink/10 bg-white font-lv-display text-small text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20 cursor-pointer appearance-none pr-10"
        >
          <option value="all">Todas las provincias</option>
          {(data?.provinces ?? []).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filtrar ranking por categoría"
          className="flex-1 min-w-[120px] h-11 sm:h-[42px] px-3 rounded-xl border border-ink/10 bg-white font-lv-display text-small text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20 cursor-pointer appearance-none pr-10"
        >
          <option value="all">Todas las categorías</option>
          {(data?.categories ?? []).map((c) => (
            <option key={c.value} value={c.label}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {loading && rows.length === 0 ? (
        /* Skeleton con la forma real de la fila — el diseño prohíbe el texto
           suelto o el spinner: el armazón anticipa el layout y la carga no
           mueve nada. */
        <div className="flex flex-col" aria-busy="true">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-gap-sm py-gap-sm border-b border-ink/5 last:border-b-0"
            >
              <div className="size-7 shrink-0 rounded-full skeleton-shimmer" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-[14px] skeleton-shimmer rounded w-[55%]" />
                <div className="h-[11px] skeleton-shimmer rounded w-[35%]" />
              </div>
              <div className="h-[22px] w-[52px] skeleton-shimmer rounded-full shrink-0" />
            </div>
          ))}
        </div>
      ) : error ? (
        <StateView
          size="sm"
          icon={RefreshCw}
          title="No se pudo cargar el ranking"
          description="Comprueba tu conexión y vuelve a intentarlo."
          className="rounded-2xl border border-ink/5 bg-sand"
        />
      ) : rows.length === 0 ? (
        <StateView
          size="sm"
          icon={Trophy}
          title="Sin interacciones registradas"
          description="El ranking crece con el uso de la app: cada vista, pin, ruta o guardado suma."
          className="rounded-2xl border border-ink/5 bg-sand"
        />
      ) : (
        <ol className="flex flex-col">
          {(expanded ? rows : rows.slice(0, 3)).map((place, i) => (
            <motion.li
              key={place.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.03,
                duration: 0.35,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex items-center gap-gap-sm py-gap-sm border-b border-ink/5 last:border-b-0"
            >
              <span
                className={cn(
                  "size-7 shrink-0 grid place-items-center rounded-full font-lv-display text-meta font-bold",
                  i === 0
                    ? "bg-verde-400 text-verde-950"
                    : i === 1
                      ? "bg-verde-100 text-verde-700"
                      : i === 2
                        ? "bg-verde-50 text-verde-600"
                        : "bg-sand text-ink-soft/75",
                )}
                aria-label={`Posición ${i + 1}`}
              >
                {i + 1}
              </span>

              {/* Identidad del negocio, igual que la lista de negocios: icono
                   de categoría en su caja verde. El icono sale de la categoría
                   que trae la propia API. */}
              <div className="hidden size-11 rounded-2xl bg-verde-50 place-items-center text-verde-600 shrink-0 sm:grid">
                <CategoryIcon
                  icon={
                    data?.categories.find((c) => c.label === place.category)
                      ?.icon ?? undefined
                  }
                  size={20}
                  strokeWidth={1.8}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-gap-xs flex-wrap">
                  <span className="font-lv-display text-small font-semibold text-ink truncate">
                    {place.name}
                  </span>
                  {place.boosted && (
                    <Sparkles
                      size={12}
                      strokeWidth={1.8}
                      className="text-verde-600 shrink-0"
                    />
                  )}
                </div>
                <div className="text-meta text-ink-soft/75 truncate">
                  {place.category ?? "—"} ·{" "}
                  {place.province ?? place.city ?? "Cuba"}
                </div>
              </div>

              {/* Métricas por gesto. En desktop, la fila completa; en móvil,
                   las tres primeras — el resto vive en el desglose inferior. */}
              <div className="hidden md:flex items-center gap-gap-sm text-meta text-ink-soft/75 shrink-0">
                {METRICS.map(({ key, label, icon: Icon }) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-[3px]"
                    aria-label={`${label}: ${place[key]}`}
                    title={label}
                  >
                    <Icon size={12} strokeWidth={1.8} />
                    <span className="hidden lg:inline">{place[key]}</span>
                    <span className="lg:hidden">{place[key]}</span>
                  </span>
                ))}
              </div>

              {/* La puntuación total: misma píldora que los conteos del
                   dashboard (verde suave, semibold — no bold). */}
              <span
                className="shrink-0 inline-flex items-center px-[8px] py-[2px] rounded-full bg-verde-50 text-verde-600 border border-verde-200 font-lv-display text-meta font-semibold"
                title="Puntuación total"
                aria-label={`Puntuación: ${place.score}`}
              >
                {place.score}
              </span>
            </motion.li>
          ))}
        </ol>
      )}
      {/* «Ver más»: el ranking vive plegado a tres filas; el botón abre el
           desglose completo sin recargar nada. Solo aparece cuando hay más
           de tres posiciones — ni en vacío, ni en error, ni cargando. */}
      {rows.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="mx-auto mt-gap-sm inline-flex h-11 sm:h-9 items-center gap-[4px] rounded-full border border-verde-200 bg-verde-50 px-gap-sm font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-verde-600 transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-100 hover:text-verde-700"
        >
          {expanded ? "Ver menos" : `Ver más (${rows.length - 3})`}
        </button>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Flame,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { MiniChart } from "@/components/business/mini-chart";
import { usePlaces } from "@/providers/places-provider";
import { presetRange, type PeriodPreset } from "@/lib/analytics/period";
import { CUBA_PROVINCES } from "@/lib/user-preferences-store";
import { cn } from "@/lib/utils";

/**
 * Panel de analítica.
 *
 * Una sola pantalla con pestañas y un selector de periodo. Los datos se piden
 * al backend en cada cambio de pestaña o filtro (`§32`, `§44`): aquí no se
 * filtra nada, solo se pinta; y las tablas largas llegan ya limitadas.
 *
 * Los módulos que necesitan credenciales externas (GA4, Search Console, Meta)
 * no inventan cifras: enseñan «no conectado» (`§29`-`§31`).
 *
 * Dos detalles que no se ven pero explican la mitad del archivo:
 *
 * - **Los datos viajan pegados a su sección.** `result` guarda `{section, data}`
 *   en un solo estado, y el render solo pinta cuando la sección guardada es la
 *   activa. Antes eran dos estados sueltos y cambiar de pestaña pintaba la vista
 *   nueva con los datos viejos: `summary → searches` hacía `reduce` sobre el
 *   payload de Resumen y tiraba la pantalla.
 * - **Escribir en un filtro no dispara una consulta por tecla.** `filters` se
 *   copia a `applied` tras una pausa; lo que viaja a la API es `applied`.
 */

type SectionId =
  | "summary"
  | "users"
  | "retention"
  | "searches"
  | "no-results"
  | "demand"
  | "businesses"
  | "business"
  | "quality"
  | "geography"
  | "funnel"
  | "sources"
  | "health"
  | "integrations"
  | "exports";

interface Section {
  id: SectionId;
  label: string;
}

/**
 * Las pestañas, en el orden en que se leen.
 *
 * `blurb` es la frase que resume la sección: va bajo el título del panel, que es
 * `h2`. Sin ella las quince secciones son la misma rejilla de números y no hay
 * forma de saber en qué se diferencian.
 */
const SECTIONS: (Section & { blurb: string })[] = [
  {
    id: "summary",
    label: "Resumen",
    blurb: "Las cifras del periodo de un vistazo.",
  },
  {
    id: "users",
    label: "Usuarios",
    blurb: "Cuántos entran, cuántos vuelven y cuántos repiten.",
  },
  {
    id: "retention",
    label: "Retención",
    blurb: "De los que empiezan a usarlo, cuántos siguen a la semana.",
  },
  {
    id: "searches",
    label: "Búsquedas",
    blurb: "Qué se busca, cuándo y con qué resultado.",
  },
  {
    id: "no-results",
    label: "Búsquedas sin resultado",
    blurb: "Lo que se pide y no existe todavía: candidatos a captar.",
  },
  {
    id: "demand",
    label: "Demanda vs oferta",
    blurb: "Dónde hay más demanda que negocios que la cubran.",
  },
  {
    id: "businesses",
    label: "Negocios",
    blurb: "El inventario: cuántos hay, por categoría y provincia.",
  },
  {
    id: "business",
    label: "Ficha de negocio",
    blurb: "Las métricas de un negocio concreto.",
  },
  {
    id: "quality",
    label: "Calidad de fichas",
    blurb:
      "Qué fichas están incompletas y cuánto les falta. Es global: no depende del periodo ni de los filtros.",
  },
  {
    id: "geography",
    label: "Geografía",
    blurb: "La actividad repartida por provincia y municipio.",
  },
  {
    id: "funnel",
    label: "Funnel",
    blurb: "Dónde se pierde la gente entre registrarse y actuar.",
  },
  {
    id: "sources",
    label: "Adquisición",
    blurb: "De dónde llega el tráfico, según las UTM.",
  },
  {
    id: "integrations",
    label: "SEO / Redes / GA4",
    blurb: "Los módulos externos y si ya tienen credenciales.",
  },
  {
    id: "health",
    label: "Salud de Analytics",
    blurb:
      "Que los eventos estén entrando y la agregación al día. Es global: mide la tabla entera, no el periodo.",
  },
  {
    id: "exports",
    label: "Exportaciones",
    blurb: "Los mismos datos, en CSV.",
  },
];

type Preset = PeriodPreset | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "90d", label: "90 días" },
  { id: "year", label: "Este año" },
  { id: "custom", label: "Personalizado" },
];

interface Filters {
  province: string;
  category: string;
  business: string;
  source: string;
  medium: string;
  campaign: string;
}

const EMPTY_FILTERS: Filters = {
  province: "",
  category: "",
  business: "",
  source: "",
  medium: "",
  campaign: "",
};

/* ── Tipos de las respuestas ─────────────────────────────────────────── */

interface Summary {
  users: {
    total: number;
    new: number;
    dau: number;
    wau: number;
    mau: number;
    recurring: number;
  };
  searches: {
    total: number;
    successful: number;
    noResults: number;
    successRate: number;
    perUser: number;
  };
  businesses: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    active: number;
    inactive: number;
  };
  discovery: {
    views: number;
    impressions: number;
    actions: number;
    searchToBusiness: number;
  };
}

interface SeriesPoint {
  day: string;
  a: number;
  b: number;
}

interface Retention {
  cohortSize: number;
  d1: number;
  d7: number;
  d14: number;
  d30: number;
}

interface SearchRow {
  label: string;
  searches: number;
  successful: number;
  noResults: number;
}

interface Searches {
  perDay: SeriesPoint[];
  perHour: { hour: number; count: number }[];
  perCategory: SearchRow[];
  perProvince: SearchRow[];
  topQueries: {
    query: string;
    searches: number;
    users: number;
    avgResults: number;
    noResultRate: number;
  }[];
}

interface NoResultRow {
  query: string;
  frequency: number;
  users: number;
  province: string;
  category: string;
}

interface DemandRow {
  label: string;
  demand: number;
  offer: number;
  ratio: number;
  score: number;
  level: "alta" | "media" | "baja";
}

interface Businesses {
  summary: Summary["businesses"];
  evolution: SeriesPoint[];
  byCategory: { label: string; count: number }[];
  byProvince: { label: string; count: number }[];
  byStatus: { label: string; count: number }[];
}

interface BusinessDetail {
  views: number;
  impressions: number;
  actions: number;
  searchesFound: number;
  contacts: { label: string; count: number }[];
  series: SeriesPoint[];
}

interface Quality {
  average: number;
  total: number;
  complete: number;
  incomplete: number;
  critical: number;
  worst: { id: string; name: string; score: number }[];
}

interface Geography {
  searchesByProvince: SearchRow[];
  searchesByMunicipality: SearchRow[];
  businessesByProvince: { label: string; count: number }[];
  activeUsersByProvince: { label: string; count: number }[];
}

interface FunnelStage {
  label: string;
  count: number;
  conversion: number;
}

interface Funnels {
  users: FunnelStage[];
  businesses: FunnelStage[];
}

interface SourceRow {
  source: string;
  medium: string;
  campaign: string;
  count: number;
}

interface Health {
  totalEvents: number;
  last24h: number;
  last7d: number;
  last30d: number;
  estimatedBytes: number;
  avgPerDay: number;
  lastAggregateDay: string | null;
  oldestEventDay: string | null;
}

interface Integrations {
  ga4: { connected: boolean; label: string };
  searchConsole: { connected: boolean; label: string };
  meta: { connected: boolean; label: string };
}

/* ── Piezas de UI ────────────────────────────────────────────────────── */

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-lv-display text-body font-semibold text-ink mb-gap-sm">
      {children}
    </h3>
  );
}

/** Entero con separador de millares. `1840` se lee mal; `1.840` no. */
function fmt(value: number): string {
  return value.toLocaleString("es-CU");
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-gap-xs">
      <span className="font-lv-display text-meta font-semibold text-verde-600 uppercase tracking-[0.14em]">
        {label}
      </span>
      <span className="font-lv-display text-[clamp(20px,3.5vw,26px)] font-bold text-ink tracking-[-0.02em] leading-none">
        {value}
      </span>
      {hint && <span className="text-meta text-ink-soft/75">{hint}</span>}
    </Card>
  );
}

function StatGrid({
  stats,
}: {
  stats: { label: string; value: string; hint?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-gap-sm">
      {stats.map((s) => (
        <Stat key={s.label} {...s} />
      ))}
    </div>
  );
}

/** Lista de barras: la forma más honesta de enseñar un ranking corto. */
function BarList({
  rows,
  format,
}: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (value: number) => string;
}) {
  if (rows.length === 0) return <Empty />;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-gap-xs">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-[3px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-small text-ink truncate">{row.label}</span>
            <span className="font-lv-display text-meta font-semibold text-ink-soft shrink-0">
              {format ? format(row.value) : row.value}
              {row.hint ? ` · ${row.hint}` : ""}
            </span>
          </div>
          <div className="h-[6px] rounded-full bg-sand-deep overflow-hidden">
            {/* La barra es decorativa: el número ya está al lado, así que un
                lector de pantalla no necesita que se lo anuncien dos veces. */}
            <div
              aria-hidden
              className="h-full rounded-full bg-verde-400"
              style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto -mx-gap-md px-gap-md">
      <table className="w-full text-small">
        <thead>
          <tr className="text-left border-b border-ink/5">
            {headers.map((h) => (
              <th
                key={h}
                className="font-lv-display text-meta uppercase tracking-[0.08em] text-ink-soft/75 py-gap-xs pr-gap-sm whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-ink/5 last:border-b-0">
              {row.map((cellValue, j) => (
                <td key={j} className="py-gap-xs pr-gap-sm text-ink align-top">
                  {cellValue}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty() {
  return (
    <p className="text-small text-ink-soft/75 py-gap-sm">
      Aún no hay datos en este periodo.
    </p>
  );
}

function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const still = useReducedMotion();
  if (stages.length === 0) return <Empty />;
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="flex flex-col gap-gap-xs">
      {stages.map((stage) => (
        <div key={stage.label} className="flex items-center gap-gap-sm">
          <span className="w-[140px] shrink-0 text-small text-ink truncate">
            {stage.label}
          </span>
          <div className="relative flex-1 h-[26px] rounded-lg bg-sand-deep overflow-hidden">
            {/* Se escala en X en vez de animar `width`: `width` es una propiedad
                de layout, así que cada fotograma recolocaba el resto de la fila.
                El número va fuera de la barra para que no se estire con ella. */}
            <motion.div
              initial={still ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: `${Math.max((stage.count / max) * 100, 3)}%`,
                transformOrigin: "left",
              }}
              className="absolute inset-y-0 left-0 rounded-lg bg-verde-400/80"
            />
            <span className="absolute inset-y-0 left-0 flex items-center px-gap-sm font-lv-display text-meta font-semibold text-verde-950 whitespace-nowrap">
              {fmt(stage.count)}
            </span>
          </div>
          <span className="w-[52px] shrink-0 text-right font-lv-display text-meta text-ink-soft/75">
            {stage.conversion}%
          </span>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}

/* ── Secciones ───────────────────────────────────────────────────────── */

function SummaryView({ data }: { data: Summary }) {
  return (
    <div className="space-y-gap-md">
      <StatGrid
        stats={[
          {
            label: "Usuarios",
            value: fmt(data.users.total),
            hint: `${data.users.new} nuevos`,
          },
          {
            label: "Activos hoy / 7 d / 30 d",
            value: `${data.users.dau} / ${data.users.wau} / ${data.users.mau}`,
            hint: `${data.users.recurring} recurrentes`,
          },
          {
            label: "Búsquedas",
            value: fmt(data.searches.total),
            hint: `${data.searches.successRate}% con resultados`,
          },
          {
            label: "Negocios",
            value: fmt(data.businesses.total),
            hint: `${data.businesses.active} activos · ${data.businesses.pending} pendientes`,
          },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gap-md">
        <Card className="lg:col-span-2">
          <CardTitle>Actividad</CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-gap-sm">
            <Metric label="Vistas de negocio" value={data.discovery.views} />
            <Metric label="Impresiones" value={data.discovery.impressions} />
            <Metric label="Acciones" value={data.discovery.actions} />
            <Metric
              label="Búsqueda → negocio"
              value={`${data.discovery.searchToBusiness}%`}
            />
          </div>
        </Card>
        <Card className="bg-sand border-verde-200/60">
          <div className="flex items-center gap-2 mb-gap-sm">
            <Flame size={16} strokeWidth={1.8} className="text-verde-600" />
            <h3 className="font-lv-display text-body font-semibold text-ink">
              Oportunidades
            </h3>
          </div>
          <p className="text-small text-ink-soft/75 leading-relaxed">
            En <strong className="text-ink">Búsquedas sin resultado</strong>{" "}
            está lo que se pide y no existe. En{" "}
            <strong className="text-ink">Demanda vs oferta</strong>, las
            categorías y zonas donde captar un negocio rinde más.
          </p>
        </Card>
      </div>
    </div>
  );
}

/**
 * Cifra secundaria dentro de una tarjeta.
 *
 * Sin fondo ni borde propios: ya vive dentro de un `Card`, y una tarjeta dentro
 * de otra tarjeta era exactamente lo que hacía esta rejilla. El peso lo lleva
 * el número, no el contenedor.
 */
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="font-lv-display text-meta font-semibold text-ink-soft/75 uppercase tracking-[0.1em]">
        {label}
      </span>
      <span className="font-lv-display text-[20px] font-bold text-ink">
        {value}
      </span>
    </div>
  );
}

function UsersView({
  data,
}: {
  data: { summary: Summary; series: SeriesPoint[] };
}) {
  const u = data.summary.users;
  return (
    <div className="space-y-gap-md">
      <StatGrid
        stats={[
          { label: "Usuarios totales", value: fmt(u.total) },
          { label: "Nuevos", value: fmt(u.new) },
          { label: "Recurrentes", value: fmt(u.recurring) },
          {
            label: "Activos hoy",
            value: fmt(u.dau),
            hint: `7 d: ${u.wau} · 30 d: ${u.mau}`,
          },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
        <MiniChart
          data={data.series.map((p) => p.a)}
          title="Nuevos usuarios por día"
          period={`${data.series.length} días`}
          unit="usuarios nuevos"
        />
        <MiniChart
          data={data.series.map((p) => p.b)}
          title="Usuarios activos por día"
          period={`${data.series.length} días`}
          unit="usuarios activos"
        />
      </div>
    </div>
  );
}

function RetentionView({ data }: { data: Retention }) {
  return (
    <div className="space-y-gap-md">
      <StatGrid
        stats={[
          {
            label: "Cohorte",
            value: fmt(data.cohortSize),
            hint: "usuarios",
          },
          { label: "D1", value: `${data.d1}%` },
          { label: "D7", value: `${data.d7}%` },
          { label: "D14 / D30", value: `${data.d14}% / ${data.d30}%` },
        ]}
      />
      <Card>
        <CardTitle>Cómo se calcula</CardTitle>
        <p className="text-small text-ink-soft/75 leading-relaxed">
          La cohorte de un usuario es el día de su primera{" "}
          <strong className="text-ink">actividad</strong> (buscar, abrir un
          negocio o interactuar con uno). Está retenido a D7 si vuelve a tener
          actividad siete días después. Entrar en la cuenta no cuenta como
          actividad: se mide volver a buscar o a abrir una ficha.
        </p>
      </Card>
    </div>
  );
}

function SearchesView({ data }: { data: Searches }) {
  const total = data.perProvince.reduce((acc, r) => acc + r.searches, 0);
  const noResults = data.perProvince.reduce((acc, r) => acc + r.noResults, 0);
  return (
    <div className="space-y-gap-md">
      <StatGrid
        stats={[
          { label: "Búsquedas", value: fmt(total) },
          { label: "Sin resultados", value: fmt(noResults) },
          {
            label: "Tasa de éxito",
            value: `${total > 0 ? (((total - noResults) / total) * 100).toFixed(1) : 0}%`,
          },
          {
            label: "Consultas listadas",
            value: fmt(data.topQueries.length),
            hint: "las 50 más frecuentes",
          },
        ]}
      />
      <MiniChart
        data={data.perDay.map((p) => p.a)}
        title="Búsquedas por día"
        period={`${data.perDay.length} días`}
        unit="búsquedas"
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
        <Card>
          <CardTitle>Por categoría</CardTitle>
          <BarList
            rows={data.perCategory.slice(0, 10).map((r) => ({
              label: r.label,
              value: r.searches,
              hint: `${r.noResults} sin resultados`,
            }))}
          />
        </Card>
        <Card>
          <CardTitle>Por provincia</CardTitle>
          <BarList
            rows={data.perProvince.slice(0, 10).map((r) => ({
              label: r.label,
              value: r.searches,
              hint: `${r.noResults} sin resultados`,
            }))}
          />
        </Card>
      </div>
      <Card>
        <CardTitle>Consultas más frecuentes</CardTitle>
        <DataTable
          headers={[
            "Consulta",
            "Búsquedas",
            "Usuarios",
            "Resultados prom.",
            "Sin resultados",
          ]}
          rows={data.topQueries
            .slice(0, 30)
            .map((q) => [
              q.query,
              q.searches,
              q.users,
              q.avgResults,
              `${q.noResultRate}%`,
            ])}
        />
      </Card>
      <Card>
        <CardTitle>Búsquedas por hora</CardTitle>
        <BarList
          rows={data.perHour.map((h) => ({
            label: `${fmt(h.hour).padStart(2, "0")}:00`,
            value: h.count,
          }))}
        />
      </Card>
    </div>
  );
}

function NoResultsView({ data }: { data: NoResultRow[] }) {
  return (
    <Card>
      <CardTitle>Demandas sin oferta</CardTitle>
      <p className="text-small text-ink-soft/75 mb-gap-sm">
        Lo que la gente busca y no encuentra. Ordenado por frecuencia: aquí se
        ve qué negocio conviene captar.
      </p>
      <DataTable
        headers={[
          "Consulta",
          "Frecuencia",
          "Usuarios",
          "Provincia",
          "Categoría",
        ]}
        rows={data.map((r) => [
          r.query,
          r.frequency,
          r.users,
          r.province,
          r.category,
        ])}
      />
    </Card>
  );
}

function LevelBadge({ level }: { level: DemandRow["level"] }) {
  const styles =
    level === "alta"
      ? "bg-verde-100 text-verde-700 border-verde-300/70"
      : level === "media"
        ? "bg-sand-deep text-ink-soft border-ink/10"
        : "bg-sand text-ink-soft/75 border-ink/5";
  return (
    <span
      className={cn(
        "inline-flex px-[8px] py-[2px] rounded-full border font-lv-display text-meta font-semibold capitalize",
        styles,
      )}
    >
      {level}
    </span>
  );
}

function DemandTable({
  rows,
  dimension,
}: {
  rows: DemandRow[];
  dimension: string;
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <DataTable
      headers={[
        dimension,
        "Demanda",
        "Oferta",
        "Ratio",
        "Índice",
        "Oportunidad",
      ]}
      rows={rows.map((r) => [
        r.label,
        r.demand,
        r.offer,
        r.ratio,
        r.score,
        <LevelBadge key={r.label} level={r.level} />,
      ])}
    />
  );
}

function DemandView({
  data,
}: {
  data: { byCategory: DemandRow[]; byProvince: DemandRow[] };
}) {
  return (
    <div className="space-y-gap-md">
      <Card>
        <CardTitle>Demanda vs Oferta por categoría</CardTitle>
        <DemandTable rows={data.byCategory} dimension="Categoría" />
      </Card>
      <Card>
        <CardTitle>Demanda vs Oferta por provincia</CardTitle>
        <DemandTable rows={data.byProvince} dimension="Provincia" />
      </Card>
      <Card className="bg-sand border-verde-200/60">
        <p className="text-small text-ink-soft/75 leading-relaxed">
          <strong className="text-ink">Fórmula:</strong> ratio = búsquedas ÷
          max(negocios activos, 1); índice = min(100, ratio ÷ 50 × 100).
          Oportunidad <strong className="text-ink">alta</strong> por encima de
          20 búsquedas por negocio, media por encima de 5.
        </p>
      </Card>
    </div>
  );
}

function BusinessesView({ data }: { data: Businesses }) {
  return (
    <div className="space-y-gap-md">
      <StatGrid
        stats={[
          { label: "Totales", value: fmt(data.summary.total) },
          { label: "Aprobados", value: fmt(data.summary.approved) },
          { label: "Pendientes", value: fmt(data.summary.pending) },
          {
            label: "Activos",
            value: fmt(data.summary.active),
            hint: `${data.summary.inactive} inactivos`,
          },
        ]}
      />
      <MiniChart
        data={data.evolution.map((p) => p.a)}
        title="Negocios registrados por día"
        period={`${data.evolution.length} días`}
        unit="negocios dados de alta"
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
        <Card>
          <CardTitle>Por categoría</CardTitle>
          <BarList
            rows={data.byCategory
              .filter((c) => c.count > 0)
              .slice(0, 12)
              .map((c) => ({ label: c.label, value: c.count }))}
          />
        </Card>
        <Card>
          <CardTitle>Por provincia</CardTitle>
          <BarList
            rows={data.byProvince
              .slice(0, 12)
              .map((c) => ({ label: c.label, value: c.count }))}
          />
        </Card>
      </div>
    </div>
  );
}

function BusinessDetailView({
  data,
  businessId,
}: {
  data: BusinessDetail;
  businessId: string;
}) {
  if (!businessId) {
    return (
      <Card>
        <p className="text-small text-ink-soft/75">
          Elige un negocio en el selector de arriba para ver sus métricas.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-gap-md">
      <StatGrid
        stats={[
          { label: "Vistas", value: fmt(data.views) },
          {
            label: "Impresiones",
            value: fmt(data.impressions),
            hint: "lo eligió una búsqueda",
          },
          { label: "Acciones", value: fmt(data.actions) },
          {
            label: "Búsquedas que lo encontraron",
            value: fmt(data.searchesFound),
          },
        ]}
      />
      <MiniChart
        data={data.series.map((p) => p.a)}
        title="Vistas por día"
        period={`${data.series.length} días`}
        unit="vistas"
      />
      <Card>
        <CardTitle>Contactos por canal</CardTitle>
        <BarList
          rows={data.contacts.map((c) => ({ label: c.label, value: c.count }))}
        />
      </Card>
    </div>
  );
}

function QualityView({ data }: { data: Quality }) {
  return (
    <div className="space-y-gap-md">
      <StatGrid
        stats={[
          { label: "Completitud media", value: `${data.average}%` },
          { label: "Completas", value: fmt(data.complete), hint: "≥ 80%" },
          {
            label: "Incompletas",
            value: fmt(data.incomplete),
            hint: "50-79%",
          },
          { label: "Críticas", value: fmt(data.critical), hint: "< 50%" },
        ]}
      />
      <Card>
        <CardTitle>Fichas más incompletas</CardTitle>
        <BarList
          rows={data.worst.map((w) => ({ label: w.name, value: w.score }))}
          format={(v) => `${v}%`}
        />
      </Card>
    </div>
  );
}

function GeographyView({ data }: { data: Geography }) {
  return (
    <div className="space-y-gap-md">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
        <Card>
          <CardTitle>Búsquedas por provincia</CardTitle>
          <BarList
            rows={data.searchesByProvince
              .slice(0, 12)
              .map((r) => ({ label: r.label, value: r.searches }))}
          />
        </Card>
        <Card>
          <CardTitle>Búsquedas por municipio</CardTitle>
          <BarList
            rows={data.searchesByMunicipality
              .slice(0, 12)
              .map((r) => ({ label: r.label, value: r.searches }))}
          />
        </Card>
        <Card>
          <CardTitle>Negocios por provincia</CardTitle>
          <BarList
            rows={data.businessesByProvince
              .slice(0, 12)
              .map((r) => ({ label: r.label, value: r.count }))}
          />
        </Card>
        <Card>
          <CardTitle>Usuarios activos por provincia</CardTitle>
          <BarList
            rows={data.activeUsersByProvince
              .slice(0, 12)
              .map((r) => ({ label: r.label, value: r.count }))}
          />
        </Card>
      </div>
    </div>
  );
}

function FunnelView({ data }: { data: Funnels }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
      <Card>
        <CardTitle>Embudo de usuarios</CardTitle>
        <FunnelChart stages={data.users} />
      </Card>
      <Card>
        <CardTitle>Embudo de negocios</CardTitle>
        <FunnelChart stages={data.businesses} />
      </Card>
    </div>
  );
}

function SourcesView({ data }: { data: SourceRow[] }) {
  return (
    <Card>
      <CardTitle>Fuentes de tráfico (UTM)</CardTitle>
      <DataTable
        headers={["Fuente", "Medio", "Campaña", "Eventos"]}
        rows={data.map((r) => [r.source, r.medium, r.campaign, r.count])}
      />
    </Card>
  );
}

function HealthView({ data }: { data: Health }) {
  const healthy = data.last24h > 0 || data.totalEvents === 0;
  return (
    <div className="space-y-gap-md">
      <StatGrid
        stats={[
          { label: "Eventos totales", value: fmt(data.totalEvents) },
          { label: "Últimas 24 h", value: fmt(data.last24h) },
          {
            label: "Últimos 7 días",
            value: fmt(data.last7d),
            hint: `${data.avgPerDay}/día (30 d)`,
          },
          {
            label: "Tamaño estimado",
            value: formatBytes(data.estimatedBytes),
            hint: "estimado",
          },
        ]}
      />
      <Card>
        <CardTitle>Estado</CardTitle>
        <ul className="text-small text-ink-soft/75 space-y-gap-xs">
          <li>
            Última agregación:{" "}
            <strong className="text-ink">
              {data.lastAggregateDay ?? "sin agregados"}
            </strong>
          </li>
          <li>
            Evento más antiguo:{" "}
            <strong className="text-ink">{data.oldestEventDay ?? "—"}</strong>
          </li>
          <li className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-[5px] font-semibold",
                healthy ? "text-verde-700" : "text-lv-amber",
              )}
            >
              {healthy ? (
                <CheckCircle2 size={15} strokeWidth={1.9} aria-hidden />
              ) : (
                <AlertTriangle size={15} strokeWidth={1.9} aria-hidden />
              )}
              {healthy ? "Normal" : "Sin eventos recientes"}
            </span>
            <span className="text-ink-soft/75">
              {healthy
                ? "los eventos entran y la agregación corre"
                : "revisa el cron: no entra nada desde ayer"}
            </span>
          </li>
        </ul>
        <p className="text-meta text-ink-soft/75 mt-gap-sm">
          El tamaño es una <strong>estimación</strong> (~250 bytes por evento
          con índices). No se consulta a Neon por métricas de consumo real.
        </p>
      </Card>
    </div>
  );
}

function IntegrationsView({ data }: { data: Integrations }) {
  const modules = [
    {
      title: "Google Analytics 4",
      connected: data.ga4.connected,
      description:
        "Usuarios, sesiones, fuentes, medios, campañas, landing pages, dispositivos y engagement. Se conectará con la API oficial cuando haya credenciales.",
    },
    {
      title: "Google Search Console",
      connected: data.searchConsole.connected,
      description:
        "Impresiones, clics, CTR, posición, consultas, páginas, dispositivos y países. La analítica interna de producto sigue siendo la fuente principal.",
    },
    {
      title: "Redes sociales (Meta)",
      connected: data.meta.connected,
      description:
        "Alcance y rendimiento de las publicaciones. Se conectará con la API oficial de Meta cuando sea prioridad.",
    },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-gap-md">
      {modules.map((m) => (
        <Card key={m.title} className="flex flex-col gap-gap-sm">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full",
                m.connected ? "bg-verde-400" : "bg-ink-soft/30",
              )}
            />
            <h3 className="font-lv-display text-body font-semibold text-ink">
              {m.title}
            </h3>
          </div>
          <p className="text-small text-ink-soft/75 leading-relaxed">
            {m.description}
          </p>
          <span className="mt-auto font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-ink-soft/75">
            {m.connected ? "Conectado" : "No conectado"}
          </span>
        </Card>
      ))}
    </div>
  );
}

const EXPORT_TYPES: { type: string; label: string }[] = [
  { type: "searches", label: "Consultas frecuentes" },
  { type: "no-results", label: "Búsquedas sin resultados" },
  { type: "demand-category", label: "Demanda vs oferta (categoría)" },
  { type: "demand-province", label: "Demanda vs oferta (provincia)" },
  { type: "businesses", label: "Negocios por categoría" },
  { type: "quality", label: "Calidad de fichas" },
  { type: "geography", label: "Geografía" },
  { type: "retention", label: "Retención" },
  { type: "funnel", label: "Funnels" },
  { type: "sources", label: "Fuentes (UTM)" },
  { type: "events", label: "Eventos crudos" },
];

function ExportsView({ query }: { query: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gap-sm">
      {EXPORT_TYPES.map((e) => (
        <a
          key={e.type}
          href={`/api/admin/analytics/export?type=${e.type}&${query}`}
          className="flex items-center justify-between gap-gap-sm bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md hover:border-verde-300 hover:bg-verde-50/40 transition-colors duration-300 ease-outquint"
        >
          <span className="text-small font-medium text-ink">{e.label}</span>
          <Download
            size={16}
            strokeWidth={1.8}
            className="text-verde-600 shrink-0"
          />
        </a>
      ))}
      <p className="sm:col-span-2 lg:col-span-3 text-meta text-ink-soft/75">
        Los CSV respetan el periodo y los filtros activos. La exportación de
        eventos crudos se genera por lotes en streaming, sin cargar toda la
        tabla en memoria.
      </p>
    </div>
  );
}

/* ── Componente principal ────────────────────────────────────────────── */

/** Los filtros que viajan en la URL, además de la sección y el periodo. */
const FILTER_KEYS = [
  "province",
  "category",
  "business",
  "source",
  "medium",
  "campaign",
] as const;

/** Los tres de texto libre: no hay lista cerrada de UTM que ofrecer. */
const TEXT_FILTERS: { key: keyof Filters; label: string; width: string }[] = [
  { key: "source", label: "Fuente (UTM)", width: "w-[132px]" },
  { key: "medium", label: "Medio", width: "w-[108px]" },
  { key: "campaign", label: "Campaña", width: "w-[132px]" },
];

export function AnalyticsDashboard() {
  const { places, categories } = usePlaces();
  const [section, setSection] = useState<SectionId>("summary");
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState(() => presetRange("30d"));
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /* `filters` es lo que se escribe; `applied` es lo que viaja a la API. Sin
     esta separación cada tecla lanzaba su consulta: escribir «La Habana» eran
     nueve viajes a Neon seguidos, cada uno con su animación de entrada. */
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  /* Sección y datos en **un solo** estado: si viajaran sueltos, cambiar de
     pestaña pintaba la vista nueva con el payload viejo y tiraba la pantalla. */
  const [result, setResult] = useState<{
    section: SectionId;
    data: unknown;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* Hasta que no se lee la URL no se escribe en ella: ver el efecto de abajo. */
  const [urlReady, setUrlReady] = useState(false);
  const still = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => setApplied(filters), 350);
    return () => clearTimeout(timer);
  }, [filters]);

  /* El estado del panel vive también en la URL: se puede compartir, marcar y
     el botón de atrás hace lo que se espera. Se lee **después** del montaje
     —leerlo en el primer render descuadraría la hidratación— y se reescribe con
     `replaceState`, sin navegación ni recarga. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("s");
    if (s && SECTIONS.some((x) => x.id === s)) setSection(s as SectionId);
    const p = params.get("p");
    if (p && PRESETS.some((x) => x.id === p)) {
      setPreset(p as Preset);
      if (p !== "custom") setRange(presetRange(p as PeriodPreset));
    }
    const from = params.get("from");
    const to = params.get("to");
    if (p === "custom" && from && to) setRange({ from, to });
    const next = { ...EMPTY_FILTERS };
    let any = false;
    for (const key of FILTER_KEYS) {
      const value = params.get(key);
      if (value) {
        next[key] = value;
        any = true;
      }
    }
    if (any) setFilters(next);
    setUrlReady(true);
  }, []);

  useEffect(() => {
    /* El guard no es decorativo: en el mismo commit en que se lee la URL el
       estado todavía es el de por defecto, así que este efecto —que corre
       después— la sobrescribiría con la vista inicial. */
    if (!urlReady) return;
    const params = new URLSearchParams({
      s: section,
      p: preset,
      from: range.from,
      to: range.to,
    });
    for (const key of FILTER_KEYS) {
      if (applied[key].trim()) params.set(key, applied[key].trim());
    }
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [urlReady, section, preset, range, applied]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    for (const [key, value] of Object.entries(applied)) {
      if (value.trim()) params.set(key, value.trim());
    }
    return params.toString();
  }, [range, applied]);

  /* El periodo se aplica al momento; solo los filtros de texto esperan a que
     se deje de escribir. Por eso `range` va por fuera de `applied`. */
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/analytics?section=${section}&${query}`,
          { signal },
        );
        const body = (await res.json()) as {
          ok: boolean;
          data?: unknown;
          error?: string;
        };
        if (!res.ok || !body.ok)
          throw new Error(body.error ?? "Error al cargar");
        setResult({ section, data: body.data });
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [section, query],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function choosePreset(next: Preset) {
    setPreset(next);
    if (next !== "custom") setRange(presetRange(next));
  }

  /** Pestañas: flechas para moverse, como un `tablist` de verdad. */
  function onTabKeys(event: React.KeyboardEvent) {
    const index = SECTIONS.findIndex((s) => s.id === section);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % SECTIONS.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + SECTIONS.length) % SECTIONS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = SECTIONS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const id = SECTIONS[next]!.id;
    setSection(id);
    /* El foco tiene que seguir a la pestaña activa, y en móvil también hay que
       acercarla: la tira scrollea y la seleccionada puede quedar fuera. */
    const tab = document.getElementById(`tab-${id}`);
    tab?.focus();
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /** Solo los datos de la sección activa. Los de otra no se pintan jamás. */
  const data = result?.section === section ? result.data : null;
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]!;
  const hasFilters = FILTER_KEYS.some((key) => filters[key].trim());

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) set.add(c.label);
    for (const p of places) if (p.category) set.add(p.category);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [categories, places]);

  return (
    <div className="flex flex-col gap-gap-md">
      <div className="flex flex-col gap-gap-sm">
        <h1 className="font-lv-display text-[clamp(22px,4vw,28px)] font-bold text-ink tracking-[-0.02em]">
          Analytics
        </h1>
        <p className="text-small text-ink-soft">
          Todo sale de los eventos de producto, en la misma base Neon que el
          resto de La Verde.
        </p>
      </div>

      {/* Periodo */}
      <div className="flex flex-wrap items-center gap-gap-xs">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choosePreset(p.id)}
            aria-pressed={preset === p.id}
            className={cn(
              "h-9 px-gap-md rounded-full font-lv-display text-small font-medium transition-colors duration-300 ease-outquint",
              preset === p.id
                ? "bg-verde-400 text-verde-950"
                : "bg-white border border-ink/5 text-ink-soft hover:bg-sand",
            )}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <span className="inline-flex items-center gap-2">
            <input
              type="date"
              aria-label="Desde"
              value={range.from}
              max={range.to}
              onChange={(e) =>
                setRange((r) => ({ ...r, from: e.target.value }))
              }
              className="h-9 px-gap-sm rounded-full border border-ink/10 bg-white text-small text-ink"
            />
            <span aria-hidden className="text-ink-soft">
              →
            </span>
            <input
              type="date"
              aria-label="Hasta"
              value={range.to}
              min={range.from}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="h-9 px-gap-sm rounded-full border border-ink/10 bg-white text-small text-ink"
            />
          </span>
        )}
      </div>

      {/* Filtros. Provincia y categoría son listas cerradas a propósito: los
          eventos guardan etiquetas, y un campo libre con una errata devolvía
          un panel vacío sin decir por qué. */}
      <div className="flex flex-wrap items-center gap-gap-xs">
        <select
          value={filters.business}
          onChange={(e) =>
            setFilters((f) => ({ ...f, business: e.target.value }))
          }
          className="h-9 px-gap-sm rounded-full border border-ink/10 bg-white text-small text-ink max-w-[200px]"
          aria-label="Negocio"
        >
          <option value="">Todos los negocios</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={filters.province}
          onChange={(e) =>
            setFilters((f) => ({ ...f, province: e.target.value }))
          }
          className="h-9 px-gap-sm rounded-full border border-ink/10 bg-white text-small text-ink"
          aria-label="Provincia"
        >
          <option value="">Todas las provincias</option>
          {CUBA_PROVINCES.map((p) => (
            <option key={p.value} value={p.label}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={filters.category}
          onChange={(e) =>
            setFilters((f) => ({ ...f, category: e.target.value }))
          }
          className="h-9 px-gap-sm rounded-full border border-ink/10 bg-white text-small text-ink"
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {categoryOptions.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        {TEXT_FILTERS.filter((f) => filters[f.key].trim() !== "").map((f) => (
          <input
            key={f.key}
            value={filters[f.key]}
            aria-label={f.label}
            placeholder={f.label}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))
            }
            className={cn(
              "h-9 px-gap-sm rounded-full border border-ink/10 bg-white text-small text-ink placeholder:text-ink-soft",
              f.width,
            )}
          />
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 h-9 px-gap-md rounded-full bg-white border border-ink/5 text-small text-ink-soft hover:bg-sand transition-colors duration-300 ease-outquint"
        >
          <RefreshCw size={14} strokeWidth={1.8} aria-hidden />
          Actualizar
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 h-9 px-gap-md rounded-full text-small text-ink-soft hover:text-ink hover:bg-sand transition-colors duration-300 ease-outquint"
          >
            <X size={14} strokeWidth={1.8} aria-hidden />
            Limpiar filtros
          </button>
        )}
        {filters.category.trim() && (
          <p className="w-full text-meta text-ink-soft">
            La categoría solo consta en las búsquedas que devolvieron resultado,
            así que este filtro acota las secciones de búsqueda y deja fuera el
            resto de la actividad.
          </p>
        )}
      </div>

      {/* Pestañas. Son un `tablist` de verdad —foco que sigue a la selección y
          flechas para moverse—, porque quince botones sueltos no dicen cuál
          está activo ni dejan recorrerlos sin tabular quince veces. */}
      <div
        role="tablist"
        aria-label="Secciones de analítica"
        onKeyDown={onTabKeys}
        className="flex gap-gap-xs overflow-x-auto pb-[2px] -mx-gap-sm px-gap-sm"
      >
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            id={`tab-${s.id}`}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            aria-controls="analytics-panel"
            tabIndex={section === s.id ? 0 : -1}
            onClick={() => setSection(s.id)}
            className={cn(
              "shrink-0 h-9 px-gap-md rounded-full font-lv-display text-small font-medium whitespace-nowrap transition-colors duration-300 ease-outquint",
              section === s.id
                ? "bg-ink text-white"
                : "bg-white border border-ink/5 text-ink-soft hover:bg-sand",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <section
        id="analytics-panel"
        role="tabpanel"
        aria-labelledby={`tab-${section}`}
        className="flex flex-col gap-gap-sm"
      >
        {/* El título de la sección: sin él las quince vistas eran la misma
            rejilla de números y no se sabía en cuál estabas. */}
        <header className="flex flex-wrap items-baseline gap-x-gap-sm gap-y-[2px]">
          <h2 className="font-lv-display text-h3 font-bold text-ink tracking-[-0.01em]">
            {active.label}
          </h2>
          <p className="text-small text-ink-soft">{active.blurb}</p>
          {/* Recargar por encima de datos ya pintados no daba ninguna señal:
              ni al cambiar de filtro ni al pulsar «Actualizar». */}
          {loading && section !== "exports" && (
            <span className="inline-flex items-center gap-[5px] font-lv-display text-meta text-ink-soft">
              <Loader2 size={12} className="animate-spin" aria-hidden />
              Actualizando
            </span>
          )}
        </header>

        {section === "exports" ? (
          <ExportsView query={query} />
        ) : error ? (
          <Card className="flex flex-wrap items-center justify-between gap-gap-sm">
            <p className="text-small text-ink">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 h-9 px-gap-md rounded-full bg-white border border-ink/10 text-small text-ink hover:bg-sand transition-colors duration-300 ease-outquint"
            >
              <RefreshCw size={14} strokeWidth={1.8} aria-hidden />
              Reintentar
            </button>
          </Card>
        ) : !data ? (
          <div className="flex items-center justify-center py-gap-xl text-ink-soft">
            <Loader2 size={20} className="animate-spin" aria-hidden />
          </div>
        ) : (
          /* La clave es la sección: un cambio de filtro actualiza los datos en
             el sitio, sin volver a montar el panel entero cada vez. */
          <motion.div
            key={section}
            initial={still ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {section === "summary" && <SummaryView data={data as Summary} />}
            {section === "users" && (
              <UsersView
                data={data as { summary: Summary; series: SeriesPoint[] }}
              />
            )}
            {section === "retention" && (
              <RetentionView data={data as Retention} />
            )}
            {section === "searches" && <SearchesView data={data as Searches} />}
            {section === "no-results" && (
              <NoResultsView data={data as NoResultRow[]} />
            )}
            {section === "demand" && (
              <DemandView
                data={
                  data as { byCategory: DemandRow[]; byProvince: DemandRow[] }
                }
              />
            )}
            {section === "businesses" && (
              <BusinessesView data={data as Businesses} />
            )}
            {section === "business" && (
              <BusinessDetailView
                data={data as BusinessDetail}
                businessId={filters.business}
              />
            )}
            {section === "quality" && <QualityView data={data as Quality} />}
            {section === "geography" && (
              <GeographyView data={data as Geography} />
            )}
            {section === "funnel" && <FunnelView data={data as Funnels} />}
            {section === "sources" && (
              <SourcesView data={data as SourceRow[]} />
            )}
            {section === "health" && <HealthView data={data as Health} />}
            {section === "integrations" && (
              <IntegrationsView data={data as Integrations} />
            )}
          </motion.div>
        )}
      </section>
    </div>
  );
}

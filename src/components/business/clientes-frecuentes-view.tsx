"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  ChevronLeft,
  Gift,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Stamp,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  estadoTarjeta,
  MAX_METAS,
  MAX_PREMIO,
  MAX_SELLOS_TOTAL,
  type FidelidadConfig,
} from "@/lib/fidelidad";
import { enmascararTelefono } from "@/lib/telefono";
import type { Funcion } from "@/lib/plans";
import type { PermisoNegocio } from "@/lib/permisos-negocio";
import type { Estadisticas } from "@/lib/fidelidad-server";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ── constantes ─────────────────────────────────────────────────────────── */

/** Días sin actividad para el filtro «Sin volver». */
const DIAS_SIN_VOLVER = 30;

/* ── tipos ───────────────────────────────────────────────────────────────── */

interface ClienteFila {
  clienteId: string;
  token: string;
  telefono: string;
  telefonoEnmascarado: string;
  nombre: string | null;
  sellos: number;
  ciclo: number;
  metaSellos: number;
  proximoPremio: string | null;
  proximoFaltan: number | null;
  premio: string | null;
  premios: { indice: number; premio: string }[];
  sellosTotales: number;
  origen: "pedido" | "manual";
  actualizadoEn: string;
  premioListo: string | null;
}

interface Movimiento {
  id: string;
  tipo: "sello" | "ajuste" | "canje" | "reversion";
  cantidad: number;
  nota: string | null;
  metaIndice: number | null;
  ciclo: number;
  creadoEn: string;
  usuario: string | null;
  pedidoCodigo: string | null;
  anulado: boolean;
}

interface Detalle {
  cliente: {
    id: string;
    telefono: string;
    telefonoEnmascarado: string;
    nombre: string | null;
    sellos: number;
    sellosTotales: number;
    ciclo: number;
    token: string;
    origen: "pedido" | "manual";
    actualizadoEn: string;
  };
  tarjeta: ReturnType<typeof estadoTarjeta>;
  movimientos: Movimiento[];
  config: FidelidadConfig;
}

type Filtro = "todos" | "premio_listo" | "sin_volver";

const MONEDAS = ["CUP", "USD", "MLC"] as const;

const FECHA = new Intl.DateTimeFormat("es-CU", {
  timeZone: "America/Havana",
  day: "numeric",
  month: "short",
});

const BTN_GHOST =
  "inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-300 ease-outquint hover:border-verde-300 hover:text-verde-700 disabled:pointer-events-none disabled:opacity-40";

const BTN_VERDE =
  "inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 transition-colors duration-300 ease-outquint hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-40";

const INPUT =
  "h-10 w-full rounded-xl border border-ink/10 bg-white px-gap-sm font-lv-display text-small text-ink outline-none placeholder:text-ink-soft/40 focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

function inicial(nombre: string | null, telefono: string): string {
  const base = nombre?.trim();
  return (base?.charAt(0) ?? telefono.slice(-2, -1)).toUpperCase();
}

/* ── tarjeta mini (panel) ───────────────────────────────────────────────── */

function TarjetaVisual({
  config,
  tarjeta,
  nombre,
  telefono,
}: {
  config: FidelidadConfig;
  tarjeta: ReturnType<typeof estadoTarjeta>;
  nombre: string | null;
  telefono: string;
}) {
  const total = config.metas[config.metas.length - 1]?.sellos ?? 5;
  const llenos = Math.min(tarjeta.sellos, total);
  const hitos = new Set(config.metas.map((m) => m.sellos));

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-verde-500 via-verde-600 to-verde-800 p-gap-sm text-verde-50 shadow-card">
      <div className="flex items-start justify-between gap-gap-xs">
        <div>
          <p className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-verde-100/80">
            {config.nombre}
          </p>
          <p className="mt-[4px] font-lv-display text-body font-bold tabular-nums text-white">
            {tarjeta.sellos}
            <span className="ml-[4px] text-meta font-medium text-verde-100/80">
              de {total}
            </span>
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-[8px] py-[2px] text-[10px] font-semibold uppercase tracking-[0.1em] text-verde-50/90 ring-1 ring-white/15">
          Ciclo {tarjeta.ciclo}
        </span>
      </div>

      <div className="mt-gap-xs grid grid-cols-5 gap-[5px]">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "grid aspect-square place-items-center rounded-lg border",
              i < llenos
                ? "border-verde-500 bg-verde-400 text-verde-950"
                : "border-dashed border-white/25 bg-white/5 text-white/25",
              hitos.has(i + 1) && i >= llenos && "border-white/50",
            )}
          >
            <Stamp size={11} strokeWidth={i < llenos ? 2 : 1.6} />
          </span>
        ))}
      </div>

      <p className="mt-gap-xs truncate font-mono text-[11px] text-verde-100/85">
        {nombre ? `${nombre} · ` : ""}
        {enmascararTelefono(telefono) ?? telefono}
      </p>
    </div>
  );
}

/* ── configuración (tab Ajustes) ────────────────────────────────────────── */

function EditorTarjeta({
  placeId,
  config,
  negocio,
  onGuardada,
}: {
  placeId: string;
  config: FidelidadConfig | null;
  negocio: { nombre: string; logoUrl: string | null } | null;
  onGuardada: (config: FidelidadConfig) => void;
}) {
  const DEFAULT_CONFIG: FidelidadConfig = {
    activo: true,
    nombre: "Tarjeta de cliente frecuente",
    metas: [{ sellos: 5, premio: "Un premio gratis" }],
    compraMinima: null,
  };

  const [modo, setModo] = useState<"ver" | "editar">(config ? "ver" : "editar");
  const [guardando, setGuardando] = useState(false);
  const [borrador, setBorrador] = useState<FidelidadConfig>(config ?? DEFAULT_CONFIG);
  const [monto, setMonto] = useState(config?.compraMinima ? String(config.compraMinima.monto) : "");
  const [moneda, setMoneda] = useState(config?.compraMinima?.moneda ?? "USD");

  /* Sincroniza borrador la primera vez que config llega del servidor (async). */
  const sincronizadoRef = useRef(false);
  useEffect(() => {
    if (config && !sincronizadoRef.current) {
      sincronizadoRef.current = true;
      setBorrador(config);
      setMonto(config.compraMinima ? String(config.compraMinima.monto) : "");
      setMoneda(config.compraMinima?.moneda ?? "USD");
    }
  }, [config]);

  const isDirty = useMemo(() => {
    if (!config) return true;
    return JSON.stringify(borrador) !== JSON.stringify(config) ||
      monto !== (config.compraMinima ? String(config.compraMinima.monto) : "") ||
      moneda !== (config.compraMinima?.moneda ?? "USD");
  }, [borrador, config, monto, moneda]);

  function descartar() {
    if (!config) return;
    setBorrador(config);
    setMonto(config.compraMinima ? String(config.compraMinima.monto) : "");
    setMoneda(config.compraMinima?.moneda ?? "USD");
  }

  /* Stepper de sellos por meta. */
  function incrementarSellos(indice: number) {
    setBorrador((b) => {
      const siguiente = b.metas[indice + 1]?.sellos;
      const tope = siguiente ? siguiente - 1 : MAX_SELLOS_TOTAL;
      return {
        ...b,
        metas: b.metas.map((m, i) =>
          i === indice ? { ...m, sellos: Math.min(m.sellos + 1, tope) } : m,
        ),
      };
    });
  }

  function decrementarSellos(indice: number) {
    setBorrador((b) => {
      const anterior = b.metas[indice - 1]?.sellos;
      const piso = anterior ? anterior + 1 : 1;
      return {
        ...b,
        metas: b.metas.map((m, i) =>
          i === indice ? { ...m, sellos: Math.max(m.sellos - 1, piso) } : m,
        ),
      };
    });
  }

  async function guardar() {
    if (guardando) return;
    const numero = Number(monto.replace(",", "."));
    const minima =
      monto.trim() && Number.isFinite(numero) && numero >= 0
        ? { monto: numero, moneda }
        : null;
    if (monto.trim() && minima === null) {
      toast.error("Ese monto de compra mínima no es un número.");
      return;
    }

    const metas = [...borrador.metas]
      .map((m) => ({ sellos: Number(m.sellos), premio: m.premio.trim() }))
      .sort((a, b) => a.sellos - b.sellos);

    const cuerpo: FidelidadConfig = { ...borrador, nombre: borrador.nombre.trim(), metas, compraMinima: minima };

    setGuardando(true);
    try {
      const res = await fetch(`/api/places/${placeId}/fidelidad`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo guardar la tarjeta.");
        return;
      }
      onGuardada(cuerpo);
      setModo("ver");
      toast.success("Tarjeta guardada.");
    } catch {
      toast.error("No se pudo guardar. Revisa la conexión.");
    } finally {
      setGuardando(false);
    }
  }

  /* Vista previa en vivo con 0 sellos. */
  const preview = useMemo(() => estadoTarjeta(borrador, 0, 1, []), [borrador]);

  /* ── vista cerrada premium ───────────────────────────────────────────── */
  if (modo === "ver" && config) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-verde-500 via-verde-600 to-verde-800 p-gap-md text-white shadow-card">
        {/* Decoración de fondo */}
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/[0.04]" />
        <div className="pointer-events-none absolute -bottom-8 right-4 size-28 rounded-full bg-white/[0.04]" />

        {/* Encabezado */}
        <div className="relative flex items-start justify-between gap-gap-sm">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-verde-100/65">
              Tarjeta de sellos
            </p>
            <p className="mt-[4px] truncate font-lv-display text-h3 font-bold text-white leading-tight">
              {config.nombre}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-[10px] py-[3px] text-[10px] font-semibold uppercase tracking-[0.1em]",
              config.activo
                ? "bg-white/15 text-verde-50 ring-1 ring-white/20"
                : "bg-white/8 text-verde-100/50 ring-1 ring-white/10",
            )}
          >
            {config.activo ? "Activa" : "Inactiva"}
          </span>
        </div>

        {/* Metas */}
        <div className="relative mt-gap-sm flex flex-col gap-[8px]">
          {config.metas.map((m, i) => {
            const esUltima = i === config.metas.length - 1;
            return (
              <div key={i} className="flex min-w-0 items-center gap-[10px]">
                <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-bold tabular-nums text-white ring-1 ring-white/20">
                  {m.sellos}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-verde-50/90">{m.premio}</span>
                {esUltima && (
                  <span className="shrink-0 text-[10px] text-verde-200/55">↺</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Compra mínima */}
        {config.compraMinima && (
          <p className="relative mt-gap-xs text-[11px] text-verde-100/60">
            Compra mínima: {config.compraMinima.monto} {config.compraMinima.moneda}
          </p>
        )}

        {/* Botón editar */}
        <div className="relative mt-gap-md">
          <button
            type="button"
            onClick={() => setModo("editar")}
            className="inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-full bg-white/15 px-gap-sm font-lv-display text-meta font-semibold text-white ring-1 ring-white/25 transition-colors duration-300 ease-outquint hover:bg-white/22 hover:ring-white/35"
          >
            <Pencil size={12} strokeWidth={2} />
            Editar tarjeta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gap-md">
      {/* Cabecera del editor con botón volver */}
      {config && (
        <div className="flex items-center gap-gap-xs">
          <button
            type="button"
            onClick={() => { descartar(); setModo("ver"); }}
            className={BTN_GHOST}
          >
            <ChevronLeft size={13} strokeWidth={2} />
            Volver
          </button>
        </div>
      )}

      {/* Vista previa */}
      <div>
        <p className="mb-gap-xs font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft/50">
          Así la ve tu cliente
        </p>
        <div className={cn(!borrador.activo && "opacity-45")}>
          <TarjetaVisual
            config={borrador}
            tarjeta={preview}
            nombre={negocio?.nombre ?? null}
            telefono="+53 5••• ••••"
          />
        </div>
        {!borrador.activo && (
          <p className="mt-[6px] text-meta text-ink-soft/55">La tarjeta está inactiva: los clientes no ven este módulo.</p>
        )}
      </div>

      {/* Interruptor activo */}
      <label className="flex cursor-pointer items-center justify-between gap-gap-sm rounded-xl border border-ink/8 bg-white p-gap-sm">
        <div>
          <p className="text-small font-semibold text-ink">Tarjeta activa</p>
          <p className="text-meta text-ink-soft/60">Tus clientes podrán dejar su teléfono al pedir y sumar sellos</p>
        </div>
        <span
          role="switch"
          aria-checked={borrador.activo}
          onClick={() => setBorrador((b) => ({ ...b, activo: !b.activo }))}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-outquint",
            borrador.activo ? "bg-verde-400" : "bg-ink/15",
          )}
        >
          <span className={cn(
            "pointer-events-none inline-block size-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ease-outquint",
            borrador.activo ? "translate-x-5" : "translate-x-0",
          )} />
        </span>
      </label>

      {/* Nombre */}
      <label className="block">
        <span className="mb-[6px] block text-meta font-semibold text-ink">Nombre de la tarjeta</span>
        <input
          type="text"
          value={borrador.nombre}
          maxLength={60}
          onChange={(e) => setBorrador((b) => ({ ...b, nombre: e.target.value }))}
          className={INPUT}
        />
      </label>

      {/* Premios (antes Metas) */}
      <div>
        <p className="mb-[6px] text-meta font-semibold text-ink">Premios</p>
        <p className="mb-gap-xs text-meta text-ink-soft/60">
          Hasta 4. El último completa la tarjeta y empieza una nueva.
        </p>
        <div className="flex flex-col gap-gap-sm">
          {borrador.metas.map((meta, indice) => {
            const esUltima = indice === borrador.metas.length - 1;
            const anterior = borrador.metas[indice - 1]?.sellos ?? 0;
            const siguiente = borrador.metas[indice + 1]?.sellos;
            const puedeSubir = meta.sellos < (siguiente ? siguiente - 1 : MAX_SELLOS_TOTAL);
            const puedeBajar = meta.sellos > anterior + 1;

            return (
              <div key={indice} className="rounded-xl border border-ink/8 bg-white p-gap-sm">
                <div className="flex items-center gap-gap-sm">
                  {/* Stepper sellos */}
                  <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-ink/10">
                    <button
                      type="button"
                      onClick={() => decrementarSellos(indice)}
                      disabled={!puedeBajar}
                      className="grid h-9 w-8 place-items-center text-ink-soft/60 transition-colors hover:bg-ink/5 disabled:opacity-30"
                      aria-label={`Bajar sellos de la meta ${indice + 1}`}
                    >
                      <span className="text-body font-semibold leading-none">−</span>
                    </button>
                    <span className="min-w-[2ch] text-center font-lv-display text-small font-semibold tabular-nums text-ink">
                      {meta.sellos}
                    </span>
                    <button
                      type="button"
                      onClick={() => incrementarSellos(indice)}
                      disabled={!puedeSubir}
                      className="grid h-9 w-8 place-items-center text-ink-soft/60 transition-colors hover:bg-ink/5 disabled:opacity-30"
                      aria-label={`Subir sellos de la meta ${indice + 1}`}
                    >
                      <span className="text-body font-semibold leading-none">+</span>
                    </button>
                  </div>
                  <span className="text-meta text-ink-soft/50">sellos →</span>
                  <input
                    type="text"
                    value={meta.premio}
                    maxLength={MAX_PREMIO}
                    placeholder="Un refresco gratis"
                    onChange={(e) =>
                      setBorrador((b) => ({
                        ...b,
                        metas: b.metas.map((m, i) =>
                          i === indice ? { ...m, premio: e.target.value } : m,
                        ),
                      }))
                    }
                    className={cn(INPUT, "min-w-0 flex-1")}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setBorrador((b) => ({
                        ...b,
                        metas: b.metas.filter((_, i) => i !== indice),
                      }))
                    }
                    disabled={borrador.metas.length === 1}
                    className={cn(BTN_GHOST, "shrink-0 px-gap-xs")}
                    aria-label="Quitar premio"
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </button>
                </div>
                <p className="mt-[6px] text-[11px] text-ink-soft/50">
                  {esUltima
                    ? "Completa la tarjeta y empieza una nueva"
                    : "Se canjea sin perder los sellos"}
                </p>
              </div>
            );
          })}
        </div>

        {borrador.metas.length < MAX_METAS &&
          (borrador.metas[borrador.metas.length - 1]?.sellos ?? 0) < MAX_SELLOS_TOTAL && (
            <button
              type="button"
              onClick={() =>
                setBorrador((b) => {
                  const ultimo = b.metas[b.metas.length - 1]?.sellos ?? 5;
                  return {
                    ...b,
                    metas: [
                      ...b.metas,
                      { sellos: Math.min(ultimo + 5, MAX_SELLOS_TOTAL), premio: "Otro premio" },
                    ],
                  };
                })
              }
              className={cn(BTN_GHOST, "mt-gap-xs")}
            >
              <Plus size={13} strokeWidth={2} />
              Añadir otro premio
            </button>
          )}
      </div>

      {/* Compra mínima */}
      <div>
        <p className="mb-[6px] text-meta font-semibold text-ink">Compra mínima para dar sello</p>
        <p className="mb-gap-xs text-meta text-ink-soft/60">Déjalo vacío si cualquier pedido da sello.</p>
        <div className="flex flex-wrap items-center gap-gap-xs">
          <input
            type="text"
            inputMode="decimal"
            value={monto}
            placeholder="Sin mínimo"
            onChange={(e) => setMonto(e.target.value)}
            className={cn(INPUT, "w-[120px] tabular-nums")}
          />
          <select
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            className={cn(INPUT, "w-[90px]")}
          >
            {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-gap-xs">
        {config && isDirty && (
          <button type="button" onClick={descartar} className={BTN_GHOST}>
            Descartar cambios
          </button>
        )}
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando || !isDirty}
          className={BTN_VERDE}
        >
          {guardando && <Loader2 size={13} strokeWidth={2} className="animate-spin" />}
          Guardar tarjeta
        </button>
      </div>
    </div>
  );
}

/* ── helper ─────────────────────────────────────────────────────────────── */

async function textoError(res: Response, porDefecto: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (data?.error) return data.error;
  return res.status === 403 ? "No tienes permiso para esto" : porDefecto;
}

/* ── vista principal ────────────────────────────────────────────────────── */

export function ClientesFrecuentesView({
  placeId,
  funciones,
  esDueno,
  permisos,
  onVerPlanes,
}: {
  placeId: string;
  funciones: Funcion[];
  esDueno: boolean;
  permisos: PermisoNegocio[];
  onVerPlanes: () => void;
}) {
  const tieneModulo = funciones.includes("cliente_frecuente");
  const tienePedidos = funciones.includes("whatsapp_pedido");
  const puedePedidos = esDueno || permisos.includes("pedidos");
  const puedeFicha = esDueno || permisos.includes("ficha");

  const [tab, setTab] = useState<"clientes" | "ajustes">("clientes");
  const [cargando, setCargando] = useState(true);
  const [config, setConfig] = useState<FidelidadConfig | null>(null);
  const [negocio, setNegocio] = useState<{ slug: string; nombre: string; logoUrl: string | null } | null>(null);
  const [clientes, setClientes] = useState<ClienteFila[]>([]);
  const [stats, setStats] = useState<Estadisticas | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const [altaAbierta, setAltaAbierta] = useState(false);
  const [selloAbierto, setSelloAbierto] = useState(false);
  const [alta, setAlta] = useState({ telefono: "", nombre: "", sellos: "0", nota: "" });
  const [selloManual, setSelloManual] = useState<{ modo: "telefono" | "codigo"; valor: string; nota: string }>(
    { modo: "telefono", valor: "", nota: "" },
  );
  const [ajuste, setAjuste] = useState({ cantidad: "1", nota: "" });
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const cargar = useCallback(
    async (q: string) => {
      setCargando(true);
      try {
        const res = await fetch(
          `/api/places/${placeId}/clientes-frecuentes?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) {
          toast.error(await textoError(res, "No se pudieron cargar las tarjetas."));
          return;
        }
        const data = (await res.json()) as {
          clientes?: ClienteFila[];
          config?: FidelidadConfig | null;
          negocio?: { slug: string; nombre: string; logoUrl: string | null } | null;
          stats?: Estadisticas;
        };
        setClientes(data.clientes ?? []);
        setConfig(data.config ?? null);
        setNegocio(data.negocio ?? null);
        if (data.stats) setStats(data.stats);
      } catch {
        toast.error("No se pudieron cargar las tarjetas. Revisa la conexión.");
      } finally {
        setCargando(false);
      }
    },
    [placeId],
  );

  useEffect(() => {
    if (!tieneModulo) return;
    const t = setTimeout(() => void cargar(busqueda), busqueda ? 300 : 0);
    return () => clearTimeout(t);
  }, [busqueda, cargar, tieneModulo]);

  const abrirDetalle = useCallback(
    async (clienteId: string) => {
      setCargandoDetalle(true);
      try {
        const res = await fetch(`/api/places/${placeId}/clientes-frecuentes/${clienteId}`);
        if (!res.ok) {
          toast.error(await textoError(res, "No se pudo abrir esa tarjeta."));
          return;
        }
        setDetalle((await res.json()) as Detalle);
        setAjuste({ cantidad: "1", nota: "" });
        setConfirmarBorrado(false);
      } finally {
        setCargandoDetalle(false);
      }
    },
    [placeId],
  );

  function enlaceTarjeta(token: string): string {
    if (typeof window === "undefined" || !negocio) return "";
    return `${window.location.origin}/m/${negocio.slug}/tarjeta/${token}`;
  }

  function avisarCliente() {
    if (!detalle || !negocio) return;
    const numero = detalle.cliente.telefono.replace(/\D/g, "");
    const saludo = detalle.cliente.nombre ? `Hola ${detalle.cliente.nombre}` : "Hola";
    const texto = `${saludo}, esta es tu tarjeta de ${negocio.nombre}. Llevas ${detalle.tarjeta.sellos} de ${detalle.tarjeta.metaFinal.sellos} sellos: ${enlaceTarjeta(detalle.cliente.token)}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  }

  async function refrescarDetalle(clienteId: string) {
    await abrirDetalle(clienteId);
    void cargar(busqueda);
  }

  async function canjear(metaIndice: number) {
    if (!detalle || ocupado) return;
    setOcupado(true);
    try {
      const res = await fetch(
        `/api/places/${placeId}/clientes-frecuentes/${detalle.cliente.id}/canje`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metaIndice }) },
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) { toast.error(data?.error ?? "No se pudo canjear el premio."); return; }
      toast.success("Premio canjeado.");
      await refrescarDetalle(detalle.cliente.id);
    } finally {
      setOcupado(false);
    }
  }

  async function ajustarSellos(signo: 1 | -1) {
    if (!detalle || ocupado) return;
    const n = Math.abs(Number(ajuste.cantidad));
    if (!Number.isInteger(n) || n === 0) { toast.error("Pon una cantidad entera."); return; }
    if (!ajuste.nota.trim()) { toast.error("La nota es obligatoria: explica el ajuste."); return; }
    setOcupado(true);
    try {
      const res = await fetch(
        `/api/places/${placeId}/clientes-frecuentes/${detalle.cliente.id}/sellos`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cantidad: n * signo, nota: ajuste.nota.trim() }) },
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) { toast.error(data?.error ?? "No se pudo ajustar."); return; }
      toast.success(signo > 0 ? "Sellos sumados." : "Sellos restados.");
      await refrescarDetalle(detalle.cliente.id);
    } finally {
      setOcupado(false);
    }
  }

  async function borrar() {
    if (!detalle || ocupado) return;
    setOcupado(true);
    try {
      const res = await fetch(`/api/places/${placeId}/clientes-frecuentes/${detalle.cliente.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error(await textoError(res, "No se pudo borrar el cliente.")); return; }
      toast.success("Cliente borrado.");
      setDetalle(null);
      void cargar(busqueda);
    } finally {
      setOcupado(false);
    }
  }

  async function crearCliente() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const res = await fetch(`/api/places/${placeId}/clientes-frecuentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: alta.telefono, nombre: alta.nombre.trim() || null, sellos: Number(alta.sellos) || 0, nota: alta.nota }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) { toast.error(data?.error ?? "No se pudo crear la tarjeta."); return; }
      toast.success("Tarjeta creada.");
      setAltaAbierta(false);
      setAlta({ telefono: "", nombre: "", sellos: "0", nota: "" });
      void cargar(busqueda);
    } finally {
      setOcupado(false);
    }
  }

  async function darSelloManual() {
    if (ocupado) return;
    const valor = selloManual.valor.trim();
    if (!valor) {
      toast.error(selloManual.modo === "telefono" ? "Escribe el teléfono." : "Escribe el código del pedido.");
      return;
    }
    setOcupado(true);
    try {
      const res = await fetch(`/api/places/${placeId}/fidelidad/sello`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selloManual.modo === "telefono"
            ? { telefono: valor, nota: selloManual.nota.trim() || null }
            : { codigo: valor },
        ),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; resultado?: { estado: string } } | null;
      if (!res.ok) { toast.error(data?.error ?? "No se pudo dar el sello."); return; }
      const estado = data?.resultado?.estado;
      if (estado === "sumado") toast.success("Sello sumado.");
      else if (estado === "duplicado") toast.info("Ese pedido ya tenía su sello.");
      else if (estado === "sin_comprobar") toast.info("No se pudo comprobar la compra mínima.");
      else if (estado === "bajo_minimo") toast.info("El pedido no llega a la compra mínima.");
      else if (estado === "sin_telefono") toast.info("Ese pedido no tiene teléfono.");
      else toast.info("No se sumó el sello.");
      setSelloAbierto(false);
      setSelloManual({ modo: "telefono", valor: "", nota: "" });
      void cargar(busqueda);
    } finally {
      setOcupado(false);
    }
  }

  /* +Sello por fila: optimista + undo en toast de 6 s */
  async function darSelloPorId(clienteId: string, nombre: string | null) {
    /* Actualización optimista */
    setClientes((cs) =>
      cs.map((c) =>
        c.clienteId === clienteId
          ? { ...c, sellos: c.sellos + 1, sellosTotales: c.sellosTotales + 1 }
          : c,
      ),
    );

    try {
      const res = await fetch(
        `/api/places/${placeId}/clientes-frecuentes/${clienteId}/sello`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as { movimientoId?: string; error?: string } | null;

      if (!res.ok) {
        /* Revertir optimismo */
        setClientes((cs) =>
          cs.map((c) =>
            c.clienteId === clienteId
              ? { ...c, sellos: c.sellos - 1, sellosTotales: c.sellosTotales - 1 }
              : c,
          ),
        );
        toast.error(data?.error ?? "No se pudo dar el sello.");
        return;
      }

      const movimientoId = data?.movimientoId ?? "";
      const etiqueta = nombre?.trim() || "ese cliente";

      toast.success(`+1 sello para ${etiqueta}`, {
        duration: 6000,
        action: movimientoId
          ? {
              label: "Deshacer",
              onClick: () => void deshacerSello(clienteId, movimientoId),
            }
          : undefined,
      });
    } catch {
      setClientes((cs) =>
        cs.map((c) =>
          c.clienteId === clienteId
            ? { ...c, sellos: c.sellos - 1, sellosTotales: c.sellosTotales - 1 }
            : c,
        ),
      );
      toast.error("Error de red. Recarga la lista.");
    }
  }

  async function deshacerSello(clienteId: string, movimientoId: string) {
    /* Revertir optimista */
    setClientes((cs) =>
      cs.map((c) =>
        c.clienteId === clienteId
          ? { ...c, sellos: Math.max(0, c.sellos - 1), sellosTotales: Math.max(0, c.sellosTotales - 1) }
          : c,
      ),
    );
    try {
      const res = await fetch(
        `/api/places/${placeId}/clientes-frecuentes/${clienteId}/sello`,
        { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ movimientoId }) },
      );
      if (!res.ok) {
        /* Volver a sumar si el deshacer falla */
        setClientes((cs) =>
          cs.map((c) =>
            c.clienteId === clienteId
              ? { ...c, sellos: c.sellos + 1, sellosTotales: c.sellosTotales + 1 }
              : c,
          ),
        );
        toast.error("No se pudo deshacer.");
      }
    } catch {
      toast.error("Error de red al deshacer.");
    }
  }

  /* Filtro cliente-side */
  const clientesFiltrados = useMemo(() => {
    if (filtro === "premio_listo") return clientes.filter((c) => c.premioListo);
    if (filtro === "sin_volver") {
      const corte = Date.now() - DIAS_SIN_VOLVER * 24 * 60 * 60 * 1000;
      return clientes.filter((c) => new Date(c.actualizadoEn).getTime() < corte);
    }
    return clientes;
  }, [clientes, filtro]);

  const conPremio = useMemo(() => clientes.filter((c) => c.premioListo).length, [clientes]);

  /* ── candados ─────────────────────────────────────────────────────────── */

  if (!tieneModulo) {
    return (
      <div className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
        <div className="flex items-center gap-gap-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sand-deep text-verde-600">
            <Lock size={18} strokeWidth={1.8} />
          </span>
          <div>
            <h1 className="font-lv-display text-small font-semibold text-ink">Cliente frecuente</h1>
            <p className="text-meta text-ink-soft/75">La tarjeta de sellos entra con el módulo Cliente frecuente.</p>
          </div>
        </div>
        <button type="button" onClick={onVerPlanes} className={cn(BTN_VERDE, "mt-gap-md")}>Ver planes</button>
      </div>
    );
  }

  if (!tienePedidos) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-gap-md">
        <div className="flex items-center gap-gap-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700">
            <Lock size={18} strokeWidth={1.8} />
          </span>
          <div>
            <h1 className="font-lv-display text-small font-semibold text-ink">Necesita Pedidos y reservas</h1>
            <p className="text-meta text-amber-800/85">La tarjeta suma un sello cuando un pedido se marca entregado. Sin pedidos guardados no hay nada que sellar.</p>
          </div>
        </div>
        <button type="button" onClick={onVerPlanes} className={cn(BTN_VERDE, "mt-gap-md")}>Ver planes</button>
      </div>
    );
  }

  /* ── detalle de cliente ───────────────────────────────────────────────── */

  if (detalle) {
    const tarjetaDetalle = detalle.tarjeta;
    return (
      <div className="flex flex-1 flex-col gap-gap-md">
        <div className="flex items-center gap-gap-xs">
          <button
            type="button"
            onClick={() => { setDetalle(null); setConfirmarBorrado(false); }}
            className={BTN_GHOST}
          >
            <ChevronLeft size={13} strokeWidth={2} />
            Clientes
          </button>
          {cargandoDetalle && <Loader2 size={14} className="animate-spin text-verde-500" />}
        </div>

        <TarjetaVisual
          config={detalle.config}
          tarjeta={tarjetaDetalle}
          nombre={detalle.cliente.nombre}
          telefono={detalle.cliente.telefono}
        />

        {tarjetaDetalle.listas.length > 0 && (
          <div className="rounded-2xl border border-verde-300 bg-verde-50 p-gap-sm">
            <p className="flex items-center gap-[5px] font-lv-display text-small font-semibold text-verde-800">
              <BadgeCheck size={15} strokeWidth={2} />
              Premio listo
            </p>
            <div className="mt-gap-xs flex flex-wrap gap-gap-xs">
              {tarjetaDetalle.listas.map((lista) => (
                <button
                  key={lista.sellos}
                  type="button"
                  onClick={() => void canjear(detalle.config.metas.indexOf(lista))}
                  disabled={ocupado || !puedePedidos}
                  className={BTN_VERDE}
                >
                  <Gift size={13} strokeWidth={2} />
                  Canjear {lista.premio}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-gap-xs">
          <button type="button" onClick={avisarCliente} disabled={!puedePedidos} className={BTN_VERDE}>
            <MessageCircle size={13} strokeWidth={1.8} />
            Enviar tarjeta por WhatsApp
          </button>
          <a href={enlaceTarjeta(detalle.cliente.token)} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>
            Ver como el cliente
          </a>
        </div>

        {puedeFicha && (
          <section className="rounded-2xl border border-ink/5 bg-white p-gap-sm shadow-soft">
            <h2 className="font-lv-display text-small font-semibold text-ink">Ajustar sellos</h2>
            <p className="mt-[2px] text-meta text-ink-soft/70">La nota es obligatoria: es lo que explica el saldo más adelante.</p>
            <div className="mt-gap-xs flex flex-wrap items-center gap-gap-xs">
              <input
                type="number" min={1} max={100} value={ajuste.cantidad}
                onChange={(e) => setAjuste((a) => ({ ...a, cantidad: e.target.value }))}
                className={cn(INPUT, "w-[84px] tabular-nums")}
              />
              <input
                type="text" value={ajuste.nota} maxLength={300} placeholder="Motivo (obligatorio)"
                onChange={(e) => setAjuste((a) => ({ ...a, nota: e.target.value }))}
                className={cn(INPUT, "min-w-[180px] flex-1")}
              />
              <button type="button" onClick={() => void ajustarSellos(1)} disabled={ocupado} className={BTN_GHOST}>+ Sumar</button>
              <button type="button" onClick={() => void ajustarSellos(-1)} disabled={ocupado} className={BTN_GHOST}>− Restar</button>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-ink/5 bg-white shadow-soft">
          <h2 className="px-gap-sm pt-gap-sm font-lv-display text-small font-semibold text-ink">Historial</h2>
          <ul className="mt-gap-xs divide-y divide-ink/5">
            {detalle.movimientos.map((m) => (
              <li key={m.id} className="flex items-center gap-gap-sm px-gap-sm py-[8px]">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-sand-deep text-ink-soft/60">
                  {m.tipo === "canje" ? <Gift size={13} strokeWidth={1.8} /> : <Stamp size={13} strokeWidth={1.8} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-meta font-medium text-ink">
                    {m.tipo === "sello"
                      ? m.pedidoCodigo ? `Sello del pedido #${m.pedidoCodigo}` : "Sello a mano"
                      : m.tipo === "canje"
                        ? `Canje de ${detalle.config.metas[m.metaIndice ?? 0]?.premio ?? "premio"}`
                        : m.tipo === "reversion"
                          ? "Pedido cancelado"
                          : m.nota?.trim() || "Ajuste"}
                  </p>
                  <p className="text-[11px] text-ink-soft/55">
                    {FECHA.format(new Date(m.creadoEn))}
                    {m.usuario ? ` · ${m.usuario}` : ""}
                    {m.anulado ? " · anulado" : ""}
                  </p>
                </div>
                {m.cantidad !== 0 && (
                  <span className={cn("shrink-0 text-meta font-semibold tabular-nums", m.cantidad > 0 ? "text-verde-700" : "text-ink-soft/50")}>
                    {m.cantidad > 0 ? "+" : ""}{m.cantidad}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {puedeFicha && (
          <div className="flex flex-wrap items-center justify-between gap-gap-xs rounded-2xl border border-destructive/20 bg-destructive/5 p-gap-sm">
            <p className="text-meta text-ink-soft/75">Borrar la tarjeta borra también su historial.</p>
            {confirmarBorrado ? (
              <div className="flex gap-gap-xs">
                <button type="button" onClick={() => void borrar()} disabled={ocupado}
                  className="inline-flex h-9 cursor-pointer items-center rounded-full bg-destructive px-gap-sm font-lv-display text-meta font-semibold text-white">
                  Sí, borrar
                </button>
                <button type="button" onClick={() => setConfirmarBorrado(false)} className={BTN_GHOST}>Cancelar</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmarBorrado(true)}
                className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full border border-destructive/30 px-gap-sm font-lv-display text-meta font-semibold text-destructive">
                <Trash2 size={13} strokeWidth={1.8} />
                Borrar cliente
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── lista + ajustes ─────────────────────────────────────────────────── */

  return (
    <div className="flex flex-1 flex-col gap-gap-md">
      <h1 className="sr-only">Clientes frecuentes</h1>

      {/* Control de pestañas */}
      <div role="tablist" className="flex rounded-full bg-ink/5 p-[3px]">
        {(["clientes", "ajustes"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-full px-gap-sm py-[6px] font-lv-display text-meta font-semibold transition-colors duration-300 ease-outquint",
              tab === t ? "bg-white text-ink shadow-sm" : "text-ink-soft/55 hover:text-ink",
            )}
          >
            {t === "clientes" ? "Clientes" : "Ajustes de la tarjeta"}
          </button>
        ))}
      </div>

      {/* ── Tab: Ajustes ── */}
      {tab === "ajustes" && (
        <section className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
          {puedeFicha ? (
            <EditorTarjeta
              placeId={placeId}
              config={config}
              negocio={negocio}
              onGuardada={(nueva) => { setConfig(nueva); void cargar(busqueda); }}
            />
          ) : (
            <p className="text-meta text-ink-soft/60">No tienes permiso para editar la tarjeta.</p>
          )}
        </section>
      )}

      {/* ── Tab: Clientes ── */}
      {tab === "clientes" && (
        <>
          {/* Métricas 2×2 */}
          {stats && (
            <div className="grid grid-cols-2 gap-gap-xs">
              {[
                { label: "Clientes con tarjeta", value: stats.totalClientes },
                { label: "Sellos este mes", value: stats.sellosEsteMes },
                { label: "Premios canjeados", value: stats.canjesEsteMes },
                { label: "Repiten (2+ sellos)", value: stats.repitieron },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl border border-ink/5 bg-white p-gap-sm shadow-soft">
                  <p className="font-lv-display text-h2 font-bold tabular-nums text-ink">{value}</p>
                  <p className="text-meta text-ink-soft/60">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Barra de controles */}
          <div className="flex flex-wrap items-center gap-gap-xs">
            <div className="relative">
              <Search size={13} strokeWidth={2} className="pointer-events-none absolute left-gap-sm top-1/2 -translate-y-1/2 text-ink-soft/50" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Teléfono o nombre…"
                className={cn(INPUT, "w-[200px] pl-8")}
              />
            </div>

            {puedePedidos && (
              <>
                <button type="button" onClick={() => setSelloAbierto(true)} className={BTN_GHOST}>
                  <Stamp size={13} strokeWidth={1.8} />
                  Dar sello
                </button>
                <button type="button" onClick={() => setAltaAbierta(true)} className={cn(BTN_VERDE, "ml-auto")}>
                  <UserPlus size={13} strokeWidth={2} />
                  Nuevo
                </button>
              </>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-[6px]">
            {([
              { id: "todos", label: "Todos" },
              { id: "premio_listo", label: `Premio listo${conPremio > 0 ? ` (${conPremio})` : ""}` },
              { id: "sin_volver", label: `Sin volver +${DIAS_SIN_VOLVER}d` },
            ] as { id: Filtro; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={cn(
                  "h-8 rounded-full border px-gap-sm font-lv-display text-meta font-semibold transition-colors duration-300 ease-outquint",
                  filtro === id
                    ? "border-verde-400 bg-verde-400 text-verde-950"
                    : "border-ink/10 bg-white text-ink-soft/65 hover:border-verde-300 hover:text-verde-700",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Lista */}
          {cargando ? (
            <div className="flex items-center gap-gap-sm rounded-2xl border border-ink/5 bg-white p-gap-md text-small text-ink-soft/75 shadow-soft">
              <Loader2 size={16} className="animate-spin text-verde-500" />
              Cargando tarjetas…
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-ink/5 bg-white p-gap-lg text-center shadow-soft">
              <span className="mx-auto mb-gap-sm grid size-12 place-items-center rounded-2xl bg-sand-deep text-verde-600">
                <Users size={22} strokeWidth={1.5} />
              </span>
              <p className="font-lv-display text-small font-semibold text-ink">
                {busqueda || filtro !== "todos"
                  ? "Ningún cliente coincide"
                  : "Todavía no hay tarjetas"}
              </p>
              {!busqueda && filtro === "todos" && (
                <p className="mt-[6px] text-meta text-ink-soft/60">
                  Cuando un cliente deje su teléfono al pedir, aparece aquí. También puedes añadirlos con «Nuevo».
                </p>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-gap-xs">
              {clientesFiltrados.map((cliente) => (
                <li key={cliente.clienteId}>
                  <div
                    className={cn(
                      "flex w-full items-center gap-gap-sm rounded-2xl border bg-white p-gap-sm shadow-soft transition-colors duration-300 ease-outquint",
                      cliente.premioListo
                        ? "border-verde-300 bg-verde-50/30"
                        : "border-ink/5 hover:border-verde-300",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void abrirDetalle(cliente.clienteId)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-gap-sm text-left"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-verde-50 font-lv-display text-small font-bold text-verde-700">
                        {inicial(cliente.nombre, cliente.telefono)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-lv-display text-small font-semibold text-ink">
                          {cliente.nombre?.trim() || cliente.telefonoEnmascarado}
                        </p>
                        <p className="truncate text-meta text-ink-soft/65">
                          {cliente.sellos}/{cliente.metaSellos} sellos
                          {cliente.proximoFaltan ? ` · faltan ${cliente.proximoFaltan}` : ""}
                          {cliente.ciclo > 1 ? ` · ciclo ${cliente.ciclo}` : ""}
                        </p>
                      </div>
                      {cliente.premioListo ? (
                        <span className="inline-flex max-w-[90px] shrink-0 items-center gap-[3px] rounded-full border border-verde-300 bg-verde-50 px-[8px] py-[3px] font-lv-display text-[10px] font-semibold text-verde-700">
                          <Gift size={9} strokeWidth={2} className="shrink-0" />
                          <span className="truncate">{cliente.premioListo}</span>
                        </span>
                      ) : (
                        <span className="shrink-0 text-meta text-ink-soft/45">
                          {cliente.sellosTotales === 0
                            ? "Nuevo"
                            : FECHA.format(new Date(cliente.actualizadoEn))}
                        </span>
                      )}
                    </button>

                    {/* Botón +Sello por fila */}
                    {puedePedidos && (
                      <button
                        type="button"
                        onClick={() => void darSelloPorId(cliente.clienteId, cliente.nombre)}
                        aria-label={`Dar un sello a ${cliente.nombre ?? cliente.telefono}`}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ink/10 bg-white text-ink-soft/60 transition-colors hover:border-verde-400 hover:bg-verde-50 hover:text-verde-700"
                      >
                        <Stamp size={14} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* ── Alta de cliente ─────────────────────────────────────────────── */}
      <Dialog open={altaAbierta} onOpenChange={setAltaAbierta}>
        <DialogContent className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Nueva tarjeta</DialogTitle>
            <DialogDescription>
              Para pasar a digital las tarjetas impresas que ya tienes. Los sellos iniciales cuentan como un ajuste con su nota.
            </DialogDescription>
          </DialogHeader>

          <label className="block">
            <span className="mb-[6px] block text-meta font-semibold text-ink">Teléfono</span>
            <input type="tel" value={alta.telefono} onChange={(e) => setAlta((a) => ({ ...a, telefono: e.target.value }))} placeholder="+53 5 123 4567" className={INPUT} />
          </label>
          <label className="block">
            <span className="mb-[6px] block text-meta font-semibold text-ink">Nombre (opcional)</span>
            <input type="text" value={alta.nombre} maxLength={80} onChange={(e) => setAlta((a) => ({ ...a, nombre: e.target.value }))} className={INPUT} />
          </label>
          <label className="block">
            <span className="mb-[6px] block text-meta font-semibold text-ink">Sellos que ya tiene</span>
            <input type="number" min={0} max={1000} value={alta.sellos} onChange={(e) => setAlta((a) => ({ ...a, sellos: e.target.value }))} className={cn(INPUT, "w-[110px] tabular-nums")} />
          </label>
          <label className="block">
            <span className="mb-[6px] block text-meta font-semibold text-ink">
              Nota{Number(alta.sellos) > 0 ? " (obligatoria)" : " (opcional)"}
            </span>
            <input type="text" value={alta.nota} maxLength={300} placeholder="De la tarjeta impresa" onChange={(e) => setAlta((a) => ({ ...a, nota: e.target.value }))} className={INPUT} />
          </label>

          <DialogFooter>
            <button type="button" onClick={() => void crearCliente()} disabled={ocupado} className={cn(BTN_VERDE, "justify-center")}>
              {ocupado && <Loader2 size={13} className="animate-spin" />}
              Crear tarjeta
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sello a mano ────────────────────────────────────────────────── */}
      <Dialog open={selloAbierto} onOpenChange={setSelloAbierto}>
        <DialogContent className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Dar un sello a mano</DialogTitle>
            <DialogDescription>
              Para cuando el pedido no quedó guardado. Con el código, el sello pasa por el mismo camino que marcar entregado: no suma dos veces.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-gap-xs">
            {(["telefono", "codigo"] as const).map((modo) => (
              <button
                key={modo}
                type="button"
                onClick={() => setSelloManual((s) => ({ ...s, modo, valor: "" }))}
                className={cn(
                  "h-9 flex-1 rounded-full border font-lv-display text-meta font-semibold transition-colors duration-300 ease-outquint",
                  selloManual.modo === modo
                    ? "border-verde-400 bg-verde-400 text-verde-950"
                    : "border-ink/10 bg-white text-ink",
                )}
              >
                {modo === "telefono" ? "Por teléfono" : "Por código"}
              </button>
            ))}
          </div>

          <input
            type={selloManual.modo === "telefono" ? "tel" : "text"}
            value={selloManual.valor}
            onChange={(e) =>
              setSelloManual((s) => ({
                ...s,
                valor: s.modo === "codigo" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : e.target.value,
              }))
            }
            placeholder={selloManual.modo === "telefono" ? "+53 5 123 4567" : "Código #XXXXX"}
            maxLength={20}
            className={INPUT}
          />

          {selloManual.modo === "telefono" && (
            <input
              type="text"
              value={selloManual.nota}
              maxLength={300}
              placeholder="Nota (opcional)"
              onChange={(e) => setSelloManual((s) => ({ ...s, nota: e.target.value }))}
              className={INPUT}
            />
          )}

          <DialogFooter>
            <button type="button" onClick={() => void darSelloManual()} disabled={ocupado} className={cn(BTN_VERDE, "justify-center")}>
              {ocupado && <Loader2 size={13} className="animate-spin" />}
              Dar sello
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

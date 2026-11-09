"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  ChevronLeft,
  Gift,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Stamp,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { estadoTarjeta, type FidelidadConfig } from "@/lib/fidelidad";
import { enmascararTelefono } from "@/lib/telefono";
import type { Funcion } from "@/lib/plans";
import type { PermisoNegocio } from "@/lib/permisos-negocio";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ── tipos del borde ────────────────────────────────────────────────────── */

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
  tarjeta: Awaited<ReturnType<typeof estadoTarjeta>>;
  movimientos: Movimiento[];
  config: FidelidadConfig;
}

const MONEDAS = ["CUP", "USD", "MLC"] as const;

const FECHA = new Intl.DateTimeFormat("es-CU", {
  timeZone: "America/Havana",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
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

/* ── la tarjeta, en pequeño ─────────────────────────────────────────────── */

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

/* ── configuración ──────────────────────────────────────────────────────── */

function EditorTarjeta({
  placeId,
  config,
  onGuardada,
}: {
  placeId: string;
  config: FidelidadConfig | null;
  onGuardada: (config: FidelidadConfig) => void;
}) {
  const [abierto, setAbierto] = useState(!config);
  const [guardando, setGuardando] = useState(false);
  /* La primera vez que llega la config del servidor (null → FidelidadConfig),
     cerramos el editor Y sincronizamos el borrador. `useState` solo usa el
     valor inicial, así que si config=null al montar, el borrador se queda con
     el default hasta que este efecto lo corrija. */
  const sincronizadoRef = useRef(false);
  useEffect(() => {
    if (config && !sincronizadoRef.current) {
      sincronizadoRef.current = true;
      setAbierto(false);
      setBorrador(config);
      setMonto(config.compraMinima ? String(config.compraMinima.monto) : "");
      setMoneda(config.compraMinima?.moneda ?? "USD");
    }
  }, [config]);
  const [borrador, setBorrador] = useState<FidelidadConfig>(
    config ?? {
      activo: true,
      nombre: "Tarjeta de cliente frecuente",
      metas: [{ sellos: 5, premio: "Un premio gratis" }],
      compraMinima: null,
    },
  );
  const [monto, setMonto] = useState(
    config?.compraMinima ? String(config.compraMinima.monto) : "",
  );
  const [moneda, setMoneda] = useState(
    config?.compraMinima?.moneda ?? "USD",
  );

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

    const cuerpo: FidelidadConfig = {
      ...borrador,
      nombre: borrador.nombre.trim(),
      metas,
      compraMinima: minima,
    };

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
      toast.success("Tarjeta guardada.");
    } catch {
      toast.error("No se pudo guardar. Revisa la conexión.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-gap-xs">
        <div className="flex items-center gap-gap-sm">
          <span className="grid size-9 place-items-center rounded-xl bg-verde-50 text-verde-600">
            <Stamp size={16} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="font-lv-display text-small font-semibold text-ink">
              Ajustes de la tarjeta
            </h2>
            <p className="text-meta text-ink-soft/70">
              Metas, nombre y compra mínima.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className={BTN_GHOST}
        >
          {abierto ? "Cancelar" : "Editar"}
        </button>
      </div>

      {/* Resumen de solo lectura cuando ya hay config guardada */}
      {!abierto && config && (
        <div className="mt-gap-sm overflow-hidden rounded-xl bg-gradient-to-br from-verde-500 via-verde-600 to-verde-800 p-gap-sm shadow-card">
          <div className="flex items-start justify-between gap-gap-xs">
            <p className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-verde-100/80">
              {config.nombre || "Tarjeta de sellos"}
            </p>
            <span
              className={cn(
                "rounded-full px-[8px] py-[2px] text-[10px] font-semibold uppercase tracking-[0.1em] ring-1",
                config.activo
                  ? "bg-white/15 text-verde-50/90 ring-white/20"
                  : "bg-black/20 text-verde-50/50 ring-white/10",
              )}
            >
              {config.activo ? "Activa" : "Inactiva"}
            </span>
          </div>

          {(() => {
            const total = config.metas[config.metas.length - 1]?.sellos ?? 5;
            const hitos = new Set(config.metas.map((m) => m.sellos));
            return (
              <div className="mt-gap-xs flex flex-wrap gap-[4px]">
                {Array.from({ length: total }, (_, i) => {
                  const esHito = hitos.has(i + 1);
                  return (
                    <span
                      key={i}
                      className={cn(
                        "grid size-[28px] place-items-center rounded-md border",
                        esHito
                          ? "border-verde-300/60 bg-verde-400/50 text-white"
                          : "border-dashed border-white/20 bg-white/5 text-white/25",
                      )}
                    >
                      <Stamp size={12} strokeWidth={esHito ? 2.2 : 1.5} />
                    </span>
                  );
                })}
              </div>
            );
          })()}

          <div className="mt-gap-sm space-y-[4px]">
            {config.metas.map((m, i) => (
              <div key={i} className="flex items-center gap-[6px]">
                <span className="font-lv-display text-[11px] font-semibold tabular-nums text-white">
                  {m.sellos}
                </span>
                <span className="text-[11px] text-verde-100/60">sellos →</span>
                <span className="text-[11px] text-verde-50/90">{m.premio}</span>
              </div>
            ))}
          </div>

          {config.compraMinima && (
            <p className="mt-[6px] text-[10px] text-verde-100/60">
              Mínimo {config.compraMinima.monto} {config.compraMinima.moneda} por pedido
            </p>
          )}
        </div>
      )}

      {abierto && (
        <div className="mt-gap-md flex flex-col gap-gap-md">
          <label className="flex items-center gap-gap-sm">
            <input
              type="checkbox"
              checked={borrador.activo}
              onChange={(e) =>
                setBorrador((b) => ({ ...b, activo: e.target.checked }))
              }
              className="size-4 accent-verde-500"
            />
            <span className="text-small text-ink">
              Tarjeta activa: el cliente puede dejar su teléfono al pedir
            </span>
          </label>

          <label className="block">
            <span className="mb-[6px] block text-meta font-semibold text-ink">
              Nombre de la tarjeta
            </span>
            <input
              type="text"
              value={borrador.nombre}
              maxLength={60}
              onChange={(e) =>
                setBorrador((b) => ({ ...b, nombre: e.target.value }))
              }
              className={INPUT}
            />
          </label>

          <div>
            <p className="mb-[6px] text-meta font-semibold text-ink">
              Metas (de 1 a 4, en orden)
            </p>
            <div className="flex flex-col gap-gap-xs">
              {borrador.metas.map((meta, indice) => (
                <div key={indice} className="flex flex-wrap items-center gap-gap-xs">
                  <div className="flex items-center gap-[6px]">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={meta.sellos}
                      onChange={(e) =>
                        setBorrador((b) => ({
                          ...b,
                          metas: b.metas.map((m, i) =>
                            i === indice
                              ? { ...m, sellos: Number(e.target.value) }
                              : m,
                          ),
                        }))
                      }
                      className={cn(INPUT, "w-[74px] tabular-nums")}
                    />
                    <span className="text-meta text-ink-soft/70">sellos →</span>
                  </div>
                  <input
                    type="text"
                    value={meta.premio}
                    maxLength={80}
                    placeholder="Un refresco gratis"
                    onChange={(e) =>
                      setBorrador((b) => ({
                        ...b,
                        metas: b.metas.map((m, i) =>
                          i === indice ? { ...m, premio: e.target.value } : m,
                        ),
                      }))
                    }
                    className={cn(INPUT, "min-w-[160px] flex-1")}
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
                    className={cn(BTN_GHOST, "px-gap-xs")}
                    aria-label="Quitar meta"
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
            {borrador.metas.length < 4 && (
              <button
                type="button"
                onClick={() =>
                  setBorrador((b) => ({
                    ...b,
                    metas: [
                      ...b.metas,
                      {
                        sellos: (b.metas[b.metas.length - 1]?.sellos ?? 5) + 5,
                        premio: "Otro premio",
                      },
                    ],
                  }))
                }
                className={cn(BTN_GHOST, "mt-gap-xs")}
              >
                <Plus size={13} strokeWidth={2} />
                Otra meta
              </button>
            )}
            <p className="mt-gap-xs text-meta text-ink-soft/60">
              Las metas intermedias se canjean sin restar sellos; la última
              cierra la tarjeta y la reinicia con los sellos que sobren.
            </p>
          </div>

          <div>
            <p className="mb-[6px] text-meta font-semibold text-ink">
              Compra mínima para dar sello
            </p>
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
                className={cn(INPUT, "w-[100px]")}
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="text-meta text-ink-soft/60">
                Vacío = cualquier pedido da sello.
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={guardando}
              className={BTN_VERDE}
            >
              {guardando && (
                <Loader2 size={13} strokeWidth={2} className="animate-spin" />
              )}
              Guardar tarjeta
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * El texto del error que manda el servidor, con el 403 ya redactado.
 *
 * Las rutas de la tarjeta contestan 403 cuando la cuenta no tiene el permiso
 * («No tienes permiso para esto») y 401 solo cuando no hay sesión. Aquí no se
 * cierra la sesión de nadie: se cuenta lo que pasa.
 */
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

  const [cargando, setCargando] = useState(true);
  const [config, setConfig] = useState<FidelidadConfig | null>(null);
  const [negocio, setNegocio] = useState<{
    slug: string;
    nombre: string;
    logoUrl: string | null;
  } | null>(null);
  const [clientes, setClientes] = useState<ClienteFila[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const [altaAbierta, setAltaAbierta] = useState(false);
  const [selloAbierto, setSelloAbierto] = useState(false);
  const [alta, setAlta] = useState({
    telefono: "",
    nombre: "",
    sellos: "0",
    nota: "",
  });
  const [selloManual, setSelloManual] = useState<{
    modo: "telefono" | "codigo";
    valor: string;
    nota: string;
  }>({ modo: "telefono", valor: "", nota: "" });

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
        };
        setClientes(data.clientes ?? []);
        setConfig(data.config ?? null);
        setNegocio(data.negocio ?? null);
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
        const res = await fetch(
          `/api/places/${placeId}/clientes-frecuentes/${clienteId}`,
        );
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

  /* El enlace público de la tarjeta. Se arma en el navegador porque el origen
     es el de la pestaña, no una constante del servidor. */
  function enlaceTarjeta(token: string): string {
    if (typeof window === "undefined" || !negocio) return "";
    return `${window.location.origin}/m/${negocio.slug}/tarjeta/${token}`;
  }

  function avisarCliente() {
    if (!detalle || !negocio) return;
    const numero = detalle.cliente.telefono.replace(/\D/g, "");
    const saludo = detalle.cliente.nombre
      ? `Hola ${detalle.cliente.nombre}`
      : "Hola";
    const texto = `${saludo}, esta es tu tarjeta de ${negocio.nombre}. Llevas ${detalle.tarjeta.sellos} de ${detalle.tarjeta.metaFinal.sellos} sellos: ${enlaceTarjeta(detalle.cliente.token)}`;
    window.open(
      `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer",
    );
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
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metaIndice }),
        },
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo canjear el premio.");
        return;
      }
      toast.success("Premio canjeado.");
      await refrescarDetalle(detalle.cliente.id);
    } finally {
      setOcupado(false);
    }
  }

  async function ajustarSellos(signo: 1 | -1) {
    if (!detalle || ocupado) return;
    const n = Math.abs(Number(ajuste.cantidad));
    if (!Number.isInteger(n) || n === 0) {
      toast.error("Pon una cantidad entera.");
      return;
    }
    if (!ajuste.nota.trim()) {
      toast.error("La nota es obligatoria: explica el ajuste.");
      return;
    }
    setOcupado(true);
    try {
      const res = await fetch(
        `/api/places/${placeId}/clientes-frecuentes/${detalle.cliente.id}/sellos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cantidad: n * signo, nota: ajuste.nota.trim() }),
        },
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo ajustar.");
        return;
      }
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
      const res = await fetch(
        `/api/places/${placeId}/clientes-frecuentes/${detalle.cliente.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast.error(await textoError(res, "No se pudo borrar el cliente."));
        return;
      }
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
        body: JSON.stringify({
          telefono: alta.telefono,
          nombre: alta.nombre.trim() || null,
          sellos: Number(alta.sellos) || 0,
          nota: alta.nota,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo crear la tarjeta.");
        return;
      }
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
      toast.error(
        selloManual.modo === "telefono"
          ? "Escribe el teléfono."
          : "Escribe el código del pedido.",
      );
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
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        resultado?: { estado: string };
      } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo dar el sello.");
        return;
      }
      const estado = data?.resultado?.estado;
      if (estado === "sumado") {
        toast.success("Sello sumado.");
      } else if (estado === "duplicado") {
        toast.info("Ese pedido ya tenía su sello.");
      } else if (estado === "sin_comprobar") {
        toast.info("No se pudo comprobar la compra mínima.");
      } else if (estado === "bajo_minimo") {
        toast.info("El pedido no llega a la compra mínima.");
      } else if (estado === "sin_telefono") {
        toast.info("Ese pedido no tiene teléfono.");
      } else {
        toast.info("No se sumó el sello.");
      }
      setSelloAbierto(false);
      setSelloManual({ modo: "telefono", valor: "", nota: "" });
      void cargar(busqueda);
    } finally {
      setOcupado(false);
    }
  }

  const tarjetaDetalle = useMemo(() => {
    if (!detalle) return null;
    return detalle.tarjeta;
  }, [detalle]);

  /* ── candados ─────────────────────────────────────────────────────────── */

  if (!tieneModulo) {
    return (
      <div className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
        <div className="flex items-center gap-gap-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sand-deep text-verde-600">
            <Lock size={18} strokeWidth={1.8} />
          </span>
          <div>
            <h1 className="font-lv-display text-small font-semibold text-ink">
              Cliente frecuente
            </h1>
            <p className="text-meta text-ink-soft/75">
              La tarjeta de sellos entra con el módulo Cliente frecuente.
            </p>
          </div>
        </div>
        <button type="button" onClick={onVerPlanes} className={cn(BTN_VERDE, "mt-gap-md")}>
          Ver planes
        </button>
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
            <h1 className="font-lv-display text-small font-semibold text-ink">
              Necesita Pedidos y reservas
            </h1>
            <p className="text-meta text-amber-800/85">
              La tarjeta suma un sello cuando un pedido se marca entregado. Sin
              pedidos guardados no hay nada que sellar, así que se contrata con
              los dos módulos.
            </p>
          </div>
        </div>
        <button type="button" onClick={onVerPlanes} className={cn(BTN_VERDE, "mt-gap-md")}>
          Ver planes
        </button>
      </div>
    );
  }

  /* ── detalle ──────────────────────────────────────────────────────────── */

  if (detalle && tarjetaDetalle) {
    return (
      <div className="flex flex-1 flex-col gap-gap-md">
        <div className="flex items-center gap-gap-xs">
          <button
            type="button"
            onClick={() => {
              setDetalle(null);
              setConfirmarBorrado(false);
            }}
            className={BTN_GHOST}
          >
            <ChevronLeft size={13} strokeWidth={2} />
            Clientes
          </button>
          {cargandoDetalle && (
            <Loader2 size={14} className="animate-spin text-verde-500" />
          )}
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
                  onClick={() =>
                    void canjear(detalle.config.metas.indexOf(lista))
                  }
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
          <button
            type="button"
            onClick={avisarCliente}
            disabled={!puedePedidos}
            className={BTN_VERDE}
          >
            <MessageCircle size={13} strokeWidth={1.8} />
            Enviar tarjeta por WhatsApp
          </button>
          <a
            href={enlaceTarjeta(detalle.cliente.token)}
            target="_blank"
            rel="noopener noreferrer"
            className={BTN_GHOST}
          >
            Ver como el cliente
          </a>
        </div>

        {puedeFicha && (
          <section className="rounded-2xl border border-ink/5 bg-white p-gap-sm shadow-soft">
            <h2 className="font-lv-display text-small font-semibold text-ink">
              Ajustar sellos
            </h2>
            <p className="mt-[2px] text-meta text-ink-soft/70">
              La nota es obligatoria: es lo que explica el saldo más adelante.
            </p>
            <div className="mt-gap-xs flex flex-wrap items-center gap-gap-xs">
              <input
                type="number"
                min={1}
                max={100}
                value={ajuste.cantidad}
                onChange={(e) =>
                  setAjuste((a) => ({ ...a, cantidad: e.target.value }))
                }
                className={cn(INPUT, "w-[84px] tabular-nums")}
              />
              <input
                type="text"
                value={ajuste.nota}
                maxLength={300}
                placeholder="Motivo (obligatorio)"
                onChange={(e) => setAjuste((a) => ({ ...a, nota: e.target.value }))}
                className={cn(INPUT, "min-w-[180px] flex-1")}
              />
              <button
                type="button"
                onClick={() => void ajustarSellos(1)}
                disabled={ocupado}
                className={BTN_GHOST}
              >
                + Sumar
              </button>
              <button
                type="button"
                onClick={() => void ajustarSellos(-1)}
                disabled={ocupado}
                className={BTN_GHOST}
              >
                − Restar
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-ink/5 bg-white shadow-soft">
          <h2 className="px-gap-sm pt-gap-sm font-lv-display text-small font-semibold text-ink">
            Historial
          </h2>
          <ul className="mt-gap-xs divide-y divide-ink/5">
            {detalle.movimientos.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-gap-sm px-gap-sm py-[8px]"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-sand-deep text-ink-soft/60">
                  {m.tipo === "canje" ? (
                    <Gift size={13} strokeWidth={1.8} />
                  ) : (
                    <Stamp size={13} strokeWidth={1.8} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-meta font-medium text-ink">
                    {m.tipo === "sello"
                      ? m.pedidoCodigo
                        ? `Sello del pedido #${m.pedidoCodigo}`
                        : "Sello a mano"
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
                  <span
                    className={cn(
                      "shrink-0 text-meta font-semibold tabular-nums",
                      m.cantidad > 0 ? "text-verde-700" : "text-ink-soft/50",
                    )}
                  >
                    {m.cantidad > 0 ? "+" : ""}
                    {m.cantidad}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {puedeFicha && (
          <div className="flex flex-wrap items-center justify-between gap-gap-xs rounded-2xl border border-destructive/20 bg-destructive/5 p-gap-sm">
            <p className="text-meta text-ink-soft/75">
              Borrar la tarjeta borra también su historial.
            </p>
            {confirmarBorrado ? (
              <div className="flex gap-gap-xs">
                <button
                  type="button"
                  onClick={() => void borrar()}
                  disabled={ocupado}
                  className="inline-flex h-9 cursor-pointer items-center rounded-full bg-destructive px-gap-sm font-lv-display text-meta font-semibold text-white"
                >
                  Sí, borrar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmarBorrado(false)}
                  className={BTN_GHOST}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmarBorrado(true)}
                className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full border border-destructive/30 px-gap-sm font-lv-display text-meta font-semibold text-destructive"
              >
                <Trash2 size={13} strokeWidth={1.8} />
                Borrar cliente
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── lista ────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-1 flex-col gap-gap-md">
      <h1 className="sr-only">Clientes frecuentes</h1>

      {puedeFicha && (
        <EditorTarjeta
          placeId={placeId}
          config={config}
          onGuardada={(nueva) => {
            setConfig(nueva);
            void cargar(busqueda);
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-gap-xs">
        <div className="relative">
          <Search
            size={13}
            strokeWidth={2}
            className="pointer-events-none absolute left-gap-sm top-1/2 -translate-y-1/2 text-ink-soft/50"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Teléfono o nombre…"
            className={cn(INPUT, "w-[220px] pl-8")}
          />
        </div>

        <button
          type="button"
          onClick={() => void cargar(busqueda)}
          disabled={cargando}
          className={BTN_GHOST}
        >
          <RefreshCw
            size={13}
            strokeWidth={1.8}
            className={cn(cargando && "animate-spin")}
          />
          Actualizar
        </button>

        {puedePedidos && (
          <>
            <button
              type="button"
              onClick={() => setSelloAbierto(true)}
              className={cn(BTN_GHOST, "ml-auto")}
            >
              <Stamp size={13} strokeWidth={1.8} />
              Dar sello a mano
            </button>
            <button
              type="button"
              onClick={() => setAltaAbierta(true)}
              className={BTN_VERDE}
            >
              <UserPlus size={13} strokeWidth={2} />
              Nuevo cliente
            </button>
          </>
        )}
      </div>

      {cargando ? (
        <div className="flex items-center gap-gap-sm rounded-2xl border border-ink/5 bg-white p-gap-md text-small text-ink-soft/75 shadow-soft">
          <Loader2 size={16} className="animate-spin text-verde-500" />
          Cargando tarjetas…
        </div>
      ) : clientes.length === 0 ? (
        <div className="rounded-2xl border border-ink/5 bg-white p-gap-lg text-center shadow-soft">
          <span className="mx-auto mb-gap-sm grid size-12 place-items-center rounded-2xl bg-sand-deep text-verde-600">
            <Users size={22} strokeWidth={1.5} />
          </span>
          <p className="font-lv-display text-small font-semibold text-ink">
            {busqueda
              ? "Ningún cliente coincide con esa búsqueda"
              : "Todavía no hay tarjetas"}
          </p>
          {!busqueda && (
            <p className="mt-[6px] text-meta text-ink-soft/60">
              Cuando un cliente deje su teléfono al pedir, aparece aquí. También
              puedes pasar sus tarjetas impresas con «Nuevo cliente».
            </p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-gap-xs">
          {clientes.map((cliente) => (
            <li key={cliente.clienteId}>
              <button
                type="button"
                onClick={() => void abrirDetalle(cliente.clienteId)}
                className="flex w-full cursor-pointer items-center gap-gap-sm rounded-2xl border border-ink/5 bg-white p-gap-sm text-left shadow-soft transition-colors duration-300 ease-outquint hover:border-verde-300"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-verde-50 font-lv-display text-small font-bold text-verde-700">
                  {inicial(cliente.nombre, cliente.telefono)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-lv-display text-small font-semibold text-ink">
                    {cliente.nombre?.trim() || cliente.telefono}
                  </p>
                  <p className="truncate text-meta text-ink-soft/65">
                    {cliente.nombre ? `${cliente.telefono} · ` : ""}
                    {cliente.sellos} de {cliente.metaSellos} sellos
                    {cliente.proximoPremio && cliente.proximoFaltan
                      ? ` · próximo: ${cliente.proximoPremio} (faltan ${cliente.proximoFaltan})`
                      : ""}
                    {cliente.ciclo > 1 ? ` · ciclo ${cliente.ciclo}` : ""}
                  </p>
                </div>
                {cliente.premioListo ? (
                  <span className="inline-flex shrink-0 items-center gap-[3px] rounded-full border border-verde-300 bg-verde-50 px-[8px] py-[3px] font-lv-display text-[10px] font-semibold text-verde-700">
                    <Gift size={9} strokeWidth={2} />
                    {cliente.premioListo}
                  </span>
                ) : (
                  <span className="shrink-0 text-meta text-ink-soft/45">
                    {cliente.sellosTotales === 0
                      ? "Nuevo"
                      : FECHA.format(new Date(cliente.actualizadoEn))}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Alta de cliente ─────────────────────────────────────────────── */}
      <Dialog open={altaAbierta} onOpenChange={setAltaAbierta}>
        <DialogContent className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Nueva tarjeta</DialogTitle>
            <DialogDescription>
              Para pasar a digital las tarjetas impresas que ya tienes. Los
              sellos iniciales cuentan como un ajuste con su nota.
            </DialogDescription>
          </DialogHeader>

          <label className="block">
            <span className="mb-[6px] block text-meta font-semibold text-ink">
              Teléfono
            </span>
            <input
              type="tel"
              value={alta.telefono}
              onChange={(e) => setAlta((a) => ({ ...a, telefono: e.target.value }))}
              placeholder="+53 5 123 4567"
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className="mb-[6px] block text-meta font-semibold text-ink">
              Nombre (opcional)
            </span>
            <input
              type="text"
              value={alta.nombre}
              maxLength={80}
              onChange={(e) => setAlta((a) => ({ ...a, nombre: e.target.value }))}
              className={INPUT}
            />
          </label>

          <label className="block">
            <span className="mb-[6px] block text-meta font-semibold text-ink">
              Sellos que ya tiene
            </span>
            <input
              type="number"
              min={0}
              max={1000}
              value={alta.sellos}
              onChange={(e) => setAlta((a) => ({ ...a, sellos: e.target.value }))}
              className={cn(INPUT, "w-[110px] tabular-nums")}
            />
          </label>

          <label className="block">
            <span className="mb-[6px] block text-meta font-semibold text-ink">
              Nota{Number(alta.sellos) > 0 ? " (obligatoria)" : " (opcional)"}
            </span>
            <input
              type="text"
              value={alta.nota}
              maxLength={300}
              placeholder="De la tarjeta impresa"
              onChange={(e) => setAlta((a) => ({ ...a, nota: e.target.value }))}
              className={INPUT}
            />
          </label>

          <DialogFooter>
            <button
              type="button"
              onClick={() => void crearCliente()}
              disabled={ocupado}
              className={cn(BTN_VERDE, "justify-center")}
            >
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
              Para cuando el pedido no quedó guardado. Con el código, el sello
              pasa por el mismo camino que marcar entregado: no suma dos veces.
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
                valor:
                  s.modo === "codigo"
                    ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                    : e.target.value,
              }))
            }
            placeholder={
              selloManual.modo === "telefono" ? "+53 5 123 4567" : "Código #XXXXX"
            }
            maxLength={20}
            className={INPUT}
          />

          {selloManual.modo === "telefono" && (
            <input
              type="text"
              value={selloManual.nota}
              maxLength={300}
              placeholder="Nota (opcional)"
              onChange={(e) =>
                setSelloManual((s) => ({ ...s, nota: e.target.value }))
              }
              className={INPUT}
            />
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => void darSelloManual()}
              disabled={ocupado}
              className={cn(BTN_VERDE, "justify-center")}
            >
              {ocupado && <Loader2 size={13} className="animate-spin" />}
              Dar sello
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

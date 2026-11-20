"use client";

/**
 * El estado del negocio, en un solo sitio.
 *
 * Antes se cambiaba en tres pantallas con tres dibujos: las píldoras del hero
 * del dashboard (≈ 22 px de alto), el `Select` «Estado» del editor —que además
 * viajaba en el guardado de la ficha y podía pisar lo puesto desde el hero— y
 * el bloque «Pausar cocina» de Pedidos. Ahora hay una píldora en la barra
 * superior y una hoja, «Estado del negocio», que guarda todo al instante.
 *
 * Los endpoints son los de siempre:
 * - Abierto / Cerrado temp. / Cerrado y el mensaje de cierre → `PATCH
 *   /api/places/{id}` (permiso `ficha`). Abrir manda `abrirAhora: true`: fuera
 *   de horario abre de verdad hasta la próxima apertura.
 * - La cocina → `PATCH /api/places/{id}/cocina` (permiso `pedidos`), la misma
 *   `actualizarPausa` que usa `/cocina` en Telegram.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { ChefHat, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";
import { estadoCocina, type EstadoCocina } from "@/lib/ficha/cocina";
import { hastaManana } from "@/lib/disponibilidad";
import type { EntregaConfig } from "@/lib/ficha/entrega";
import type { Horario } from "@/lib/ficha/horario";
import type { PlaceStatus, UserPlace } from "@/lib/places-store";
import { usePlaces } from "@/providers/places-provider";
import { Label } from "@/components/ui/label";
import { CHAPITA, INPUT_NATIVO_HOLGADO, TONO_CHAPITA, type TonoChapita } from "./ui/clases";
import { FilaAjuste } from "./ui/tarjeta";
import { BotonSecundario } from "./ui/botones";
import { Switch } from "./ui/switch";
import { HojaPanel } from "./ui/hoja-panel";
import { usePanelNav } from "./panel-shell";

const ERROR_RED = "No se pudo cambiar. Revisa la conexión: no se cambió nada.";
const MAX_MENSAJE = 140;

export const ESTADOS: { value: PlaceStatus; label: string; hint: string }[] = [
  { value: "active", label: "Abierto", hint: "Es lo que se enseña por defecto." },
  {
    value: "temporary_closed",
    label: "Cerrado temporalmente",
    hint: "La ficha avisa de que ahora no abre.",
  },
  { value: "closed", label: "Cerrado", hint: "La ficha se sigue viendo, marcada como cerrada." },
];

const MOTIVOS = ["Sin luz", "Sin inventario", "Sin personal", "Otro motivo"] as const;

type Duracion = "1h" | "2h" | "manana" | "indefinido";
const DURACIONES: { id: Duracion; label: string }[] = [
  { id: "1h", label: "1 hora" },
  { id: "2h", label: "2 horas" },
  { id: "manana", label: "Hasta mañana" },
  { id: "indefinido", label: "Sin límite" },
];

function hastaDe(duracion: Duracion, ahora: number): number | null {
  if (duracion === "1h") return ahora + 60 * 60_000;
  if (duracion === "2h") return ahora + 2 * 60 * 60_000;
  if (duracion === "manana") return hastaManana(new Date(ahora));
  return null;
}

type Pausa = NonNullable<EntregaConfig["pausa"]>;

interface EstadoNegocioValor {
  status: PlaceStatus;
  mensaje: string;
  /** `null` si el negocio no tiene la función `horario_cocina`. */
  cocina: EstadoCocina | null;
  pausa: Pausa | null;
  puedeFicha: boolean;
  puedePedidos: boolean;
  ocupado: boolean;
  cambiarEstado: (next: PlaceStatus) => Promise<void>;
  abrirCocina: () => Promise<void>;
  pausarCocina: (pausa: Pausa) => Promise<void>;
  guardarMensaje: (texto: string) => Promise<boolean>;
}

const Ctx = createContext<EstadoNegocioValor | null>(null);

export function useEstadoNegocio(): EstadoNegocioValor {
  const valor = useContext(Ctx);
  if (!valor) throw new Error("useEstadoNegocio fuera de EstadoNegocioProvider");
  return valor;
}

const ENTREGA_VACIA: EntregaConfig = {
  costo: { modo: "consultar" },
  tiempo: { min: 0, max: 0 },
};

export function EstadoNegocioProvider({
  place,
  tieneCocina,
  puedeFicha,
  puedePedidos,
  children,
}: {
  place: Pick<UserPlace, "id" | "status" | "cerradoMensaje" | "entrega" | "horario">;
  /** La función `horario_cocina`: sin ella no se habla de cocina. */
  tieneCocina: boolean;
  puedeFicha: boolean;
  puedePedidos: boolean;
  children: ReactNode;
}) {
  const { updatePlace } = usePlaces();
  const [status, setStatus] = useState<PlaceStatus>(place.status);
  const [mensaje, setMensaje] = useState(place.cerradoMensaje ?? "");
  const [entrega, setEntrega] = useState<EntregaConfig | null>(place.entrega ?? null);
  const [ocupado, setOcupado] = useState(false);
  /* El estado de la cocina depende de la hora: se recalcula cada minuto. */
  const [ahora, setAhora] = useState(() => Date.now());

  /* Un `router.refresh()` de otra pantalla, o el cambio hecho desde Telegram,
     trae la ficha nueva: se adopta. Mientras no cambie, manda lo local. */
  useEffect(() => setStatus(place.status), [place.status]);
  useEffect(() => setMensaje(place.cerradoMensaje ?? ""), [place.cerradoMensaje]);
  useEffect(() => setEntrega(place.entrega ?? null), [place.entrega]);
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const cambiarEstado = useCallback(
    async (next: PlaceStatus) => {
      if (!puedeFicha || ocupado || next === status) return;
      const antes = status;
      setStatus(next);
      setOcupado(true);
      const ok = await updatePlace(place.id, {
        status: next,
        ...(next === "active" ? { abrirAhora: true } : {}),
      } as Parameters<typeof updatePlace>[1]);
      setOcupado(false);
      if (!ok) {
        setStatus(antes);
        toast.error(ERROR_RED);
        return;
      }
      toast.success("Guardado");
    },
    [puedeFicha, ocupado, status, updatePlace, place.id],
  );

  const enviarPausa = useCallback(
    async (pausa: Pausa | null): Promise<EntregaConfig["aperturaManual"] | null | false> => {
      const res = await fetch(`/api/places/${place.id}/cocina`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pausa }),
      }).catch(() => null);
      if (!res?.ok) return false;
      const data = (await res.json().catch(() => null)) as {
        aperturaManual?: EntregaConfig["aperturaManual"] | null;
      } | null;
      return data?.aperturaManual ?? null;
    },
    [place.id],
  );

  const abrirCocina = useCallback(async () => {
    if (!puedePedidos || ocupado) return;
    const antes = entrega;
    /* Optimista: sin pausa. La apertura manual la decide el servidor. */
    const { pausa: _p, aperturaManual: _a, ...resto } = antes ?? ENTREGA_VACIA;
    setEntrega(resto);
    setOcupado(true);
    const apertura = await enviarPausa(null);
    setOcupado(false);
    if (apertura === false) {
      setEntrega(antes);
      toast.error(ERROR_RED);
      return;
    }
    /* Fuera de horario el servidor guarda una apertura manual: sin ella aquí,
       el panel seguiría calculando «cerrada» con el horario. */
    if (apertura) setEntrega({ ...resto, aperturaManual: apertura });
    toast.success("Guardado");
  }, [puedePedidos, ocupado, entrega, enviarPausa]);

  const pausarCocina = useCallback(
    async (pausa: Pausa) => {
      if (!puedePedidos || ocupado) return;
      const antes = entrega;
      /* Cerrar quita también la apertura manual, como en el servidor. */
      const { aperturaManual: _a, ...sinApertura } = antes ?? ENTREGA_VACIA;
      setEntrega({ ...sinApertura, pausa });
      setOcupado(true);
      const ok = await enviarPausa(pausa);
      setOcupado(false);
      if (ok === false) {
        setEntrega(antes);
        toast.error(ERROR_RED);
        return;
      }
      toast.success("Guardado");
    },
    [puedePedidos, ocupado, entrega, enviarPausa],
  );

  const guardarMensaje = useCallback(
    async (texto: string) => {
      const limpio = texto.trim();
      if (!puedeFicha || limpio === (place.cerradoMensaje ?? "").trim()) return true;
      if (limpio.length > MAX_MENSAJE) return false;
      setOcupado(true);
      const ok = await updatePlace(place.id, { cerradoMensaje: limpio || null });
      setOcupado(false);
      if (!ok) {
        toast.error(ERROR_RED);
        return false;
      }
      toast.success("Guardado");
      return true;
    },
    [puedeFicha, updatePlace, place.id, place.cerradoMensaje],
  );

  const valor: EstadoNegocioValor = {
    status,
    mensaje,
    cocina: tieneCocina ? estadoCocina(entrega, place.horario as Horario | null | undefined, ahora) : null,
    pausa: entrega?.pausa ?? null,
    puedeFicha,
    puedePedidos,
    ocupado,
    cambiarEstado,
    abrirCocina,
    pausarCocina,
    guardarMensaje,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** El texto y el tono de la píldora, que también usa la franja de Pedidos. */
export function resumenEstado(
  status: PlaceStatus,
  cocina: EstadoCocina | null,
  pausa: Pausa | null,
): { texto: string; tono: TonoChapita } {
  if (status === "temporary_closed") return { texto: "Cerrado temporalmente", tono: "ambar" };
  if (status === "closed") return { texto: "Cerrado", tono: "neutra" };
  if (!cocina) return { texto: "Abierto", tono: "activa" };
  if (cocina.abierta) return { texto: "Abierto · Cocina abierta", tono: "activa" };
  return {
    texto: pausa ? "Abierto · Cocina pausada" : "Abierto · Cocina cerrada",
    tono: "ambar",
  };
}

/**
 * La píldora de la barra superior. El dibujo es el de la chapita (26 px), pero
 * el área tocable llega a 44 con un pseudoelemento, sin engordar la barra.
 */
export function PildoraEstado() {
  const { status, cocina, pausa, puedeFicha, puedePedidos } = useEstadoNegocio();
  const nav = usePanelNav();
  const { texto, tono } = resumenEstado(status, cocina, pausa);
  const clases = clsx(CHAPITA, TONO_CHAPITA[tono], "max-w-full gap-[5px] truncate");

  if (!puedeFicha && !(puedePedidos && cocina)) {
    return (
      <span className={clases} suppressHydrationWarning>
        {texto}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => nav.abrirHoja("estado")}
      aria-label={`Estado del negocio: ${texto}. Toca para cambiarlo`}
      className={clsx(
        clases,
        "relative cursor-pointer transition-colors duration-500 ease-outquint after:absolute after:inset-x-0 after:-inset-y-[9px] after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
      )}
    >
      <span className="truncate" suppressHydrationWarning>
        {texto}
      </span>
      <ChevronDown size={12} strokeWidth={2} aria-hidden className="shrink-0" />
    </button>
  );
}

/**
 * La franja de la cocina en Pedidos: dónde está y un botón que abre la hoja
 * de estado. Sustituye al bloque «Pausar cocina» que vivía bajo la lista. Sin
 * la función `horario_cocina` no se pinta.
 */
export function FranjaCocina() {
  const { cocina, pausa, puedeFicha, puedePedidos } = useEstadoNegocio();
  const nav = usePanelNav();
  if (!cocina) return null;
  const titulo = cocina.abierta ? "Cocina abierta" : pausa ? "Cocina pausada" : "Cocina cerrada";
  return (
    <div className="flex flex-wrap items-center justify-between gap-gap-sm rounded-2xl border border-ink/5 bg-white px-gap-md py-gap-sm">
      <div className="flex min-w-0 items-center gap-gap-sm">
        <ChefHat
          size={18}
          strokeWidth={1.8}
          aria-hidden
          className={cocina.abierta ? "shrink-0 text-verde-600" : "shrink-0 text-lv-amber"}
        />
        <div className="min-w-0">
          <p className="font-lv-display text-small font-semibold text-ink">{titulo}</p>
          <p className="text-meta text-ink-soft/75" suppressHydrationWarning>
            {cocina.texto}
          </p>
        </div>
      </div>
      {(puedePedidos || puedeFicha) && (
        <BotonSecundario onClick={() => nav.abrirHoja("estado")}>Cambiar</BotonSecundario>
      )}
    </div>
  );
}

/* Opción tocable de la hoja: 44 px, con el tono de la chapita al elegirla. */
function claseOpcion(elegida: boolean, tono: TonoChapita): string {
  return clsx(
    "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-gap-md font-lv-display text-meta font-semibold transition-colors duration-500 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40 disabled:pointer-events-none disabled:opacity-60",
    elegida ? TONO_CHAPITA[tono] : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:text-verde-600",
  );
}

/** La hoja «Estado del negocio». Se abre desde la píldora y la franja de Pedidos. */
export function HojaEstado() {
  const estado = useEstadoNegocio();
  const nav = usePanelNav();
  const idMensaje = useId();
  const [borrador, setBorrador] = useState(estado.mensaje);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);
  const [duracion, setDuracion] = useState<Duracion | null>(null);

  useEffect(() => setBorrador(estado.mensaje), [estado.mensaje]);

  const abierta = nav.hoja === "estado";
  const pausa = estado.pausa;
  const duracionMarcada: Duracion | null =
    duracion ?? (pausa && pausa.hasta === null ? "indefinido" : null);

  async function guardarMensaje() {
    if (borrador.trim().length > MAX_MENSAJE) {
      setErrorMensaje(`Como mucho ${MAX_MENSAJE} caracteres.`);
      return;
    }
    setErrorMensaje(null);
    const ok = await estado.guardarMensaje(borrador);
    if (!ok) setBorrador(estado.mensaje);
  }

  return (
    <HojaPanel
      open={abierta}
      onOpenChange={(open) => {
        if (!open) nav.cerrarHoja();
      }}
      titulo="Estado del negocio"
      descripcion="Lo que ven tus clientes ahora. Cada cambio se guarda al momento."
    >
      <section aria-labelledby={`${idMensaje}-estado`}>
        <h3
          id={`${idMensaje}-estado`}
          className="font-lv-display text-small font-semibold text-ink"
        >
          Hoy el negocio está
        </h3>
        <div role="group" className="mt-gap-xs flex flex-wrap gap-gap-xs">
          {ESTADOS.map((opcion) => {
            const elegida = estado.status === opcion.value;
            const tono: TonoChapita =
              opcion.value === "active"
                ? "activa"
                : opcion.value === "temporary_closed"
                  ? "ambar"
                  : "neutra";
            return (
              <button
                key={opcion.value}
                type="button"
                aria-pressed={elegida}
                disabled={!estado.puedeFicha || estado.ocupado}
                onClick={() => void estado.cambiarEstado(opcion.value)}
                className={claseOpcion(elegida, tono)}
              >
                {opcion.label}
              </button>
            );
          })}
        </div>
        <p className="mt-gap-xs text-meta text-ink-soft/75">
          {estado.puedeFicha
            ? ESTADOS.find((e) => e.value === estado.status)?.hint
            : "Lo cambia quien puede editar la ficha del negocio."}
        </p>
      </section>

      {estado.cocina && (
        <section>
          <FilaAjuste
            titulo="Cocina recibiendo pedidos"
            detalle={estado.cocina.texto}
            control={
              <Switch
                checked={estado.cocina.abierta}
                disabled={!estado.puedePedidos || estado.ocupado}
                label="Cocina recibiendo pedidos"
                onToggle={() => {
                  if (estado.cocina?.abierta) {
                    setDuracion("indefinido");
                    void estado.pausarCocina({ desde: Date.now(), hasta: null });
                  } else {
                    setDuracion(null);
                    void estado.abrirCocina();
                  }
                }}
              />
            }
          />
          {!estado.puedePedidos && (
            <p className="mt-gap-xs text-meta text-ink-soft/75">
              La pausa la pone quien atiende los pedidos.
            </p>
          )}

          {pausa && estado.puedePedidos && (
            <div className="mt-gap-sm flex flex-col gap-gap-sm">
              <div>
                <p className="font-lv-display text-meta font-semibold text-ink-soft/75">
                  Motivo
                </p>
                <div role="group" className="mt-gap-xs flex flex-wrap gap-gap-xs">
                  {MOTIVOS.map((m) => {
                    const elegido = pausa.motivo === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={elegido}
                        disabled={estado.ocupado}
                        onClick={() =>
                          void estado.pausarCocina({
                            desde: pausa.desde,
                            hasta: pausa.hasta,
                            ...(elegido ? {} : { motivo: m }),
                          })
                        }
                        className={claseOpcion(elegido, "ambar")}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="font-lv-display text-meta font-semibold text-ink-soft/75">
                  Hasta cuándo
                </p>
                <div role="group" className="mt-gap-xs flex flex-wrap gap-gap-xs">
                  {DURACIONES.map((d) => {
                    const elegida = duracionMarcada === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        aria-pressed={elegida}
                        disabled={estado.ocupado}
                        onClick={() => {
                          setDuracion(d.id);
                          void estado.pausarCocina({
                            desde: pausa.desde,
                            hasta: hastaDe(d.id, Date.now()),
                            ...(pausa.motivo ? { motivo: pausa.motivo } : {}),
                          });
                        }}
                        className={claseOpcion(elegida, "ambar")}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-gap-xs border-t border-ink/5 pt-gap-sm">
        <Label htmlFor={idMensaje} className="font-lv-display">
          Mensaje cuando estás cerrado
        </Label>
        <textarea
          id={idMensaje}
          rows={2}
          maxLength={MAX_MENSAJE}
          value={borrador}
          disabled={!estado.puedeFicha}
          onChange={(e) => setBorrador(e.target.value)}
          onBlur={() => void guardarMensaje()}
          placeholder="Ej: Volvemos el lunes a las 9:00"
          aria-invalid={errorMensaje ? true : undefined}
          aria-describedby={`${idMensaje}-ayuda`}
          className={clsx(INPUT_NATIVO_HOLGADO, "h-auto resize-y py-3 leading-relaxed")}
        />
        <p id={`${idMensaje}-ayuda`} className="text-meta text-ink-soft/75">
          {errorMensaje ??
            `Sale en tu ficha mientras no abres. Se guarda al salir del campo. ${borrador.trim().length}/${MAX_MENSAJE}`}
        </p>
      </section>
    </HojaPanel>
  );
}

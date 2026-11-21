"use client";

import { useRef, useState } from "react";
import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { AvisoGuardado, useEstadoGuardado } from "@/components/business/ui/estado-guardado";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/business/ui/switch";
import { CandadoPlan } from "@/components/business/ui/candado-plan";
import { bloqueoDe, type Funcion } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EntregaConfig, ParcheEntrega, ZonaEntrega } from "@/lib/ficha/entrega";

interface ZonasDomicilioCardProps {
  placeId: string;
  funciones: Funcion[];
  entregaInicial?: EntregaConfig | null;
  /** Lleva a Planes cuando la función no entra, como las otras tarjetas. */
  onVerPlanes?: () => void;
}

const MONEDAS = ["CUP", "USD", "MLC"] as const;
const MAX_ZONAS = 40;

/** Genera un id corto para una zona nueva. */
function nuevoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function fmtMonto(monto: number, moneda: string): string {
  return `${monto % 1 === 0 ? monto.toFixed(0) : monto.toFixed(2)} ${moneda}`;
}


export function ZonasDomicilioCard({
  placeId,
  funciones,
  entregaInicial,
  onVerPlanes,
}: ZonasDomicilioCardProps) {
  const cat = useCatalogo();
  const bloqueo = bloqueoDe(funciones, "zonas_domicilio", cat);

  /* ── Estado ──────────────────────────────────────────────────────────── */
  const zonasModo = entregaInicial?.costo.modo === "zonas" ? entregaInicial.costo.zonas : [];

  const [recogida, setRecogida] = useState(entregaInicial?.recogida ?? false);
  const [domicilio, setDomicilio] = useState(entregaInicial?.domicilio ?? false);
  const [zonas, setZonas] = useState<ZonaEntrega[]>(zonasModo);
  const [notaEntrega, setNotaEntrega] = useState(entregaInicial?.notaEntrega ?? "");
  const [pedidoMinStr, setPedidoMinStr] = useState(
    entregaInicial?.pedidoMinimo ? String(entregaInicial.pedidoMinimo.monto) : "",
  );
  const [pedidoMinMoneda, setPedidoMinMoneda] = useState(
    entregaInicial?.pedidoMinimo?.moneda ?? "CUP",
  );
  const [guardando, setGuardando] = useState(false);
  const [cambiandoModo, setCambiandoModo] = useState(false);
  /* Sin entrega previa, el primer parche tiene que llevar `costo` y `tiempo`
     para que la configuración fusionada sea válida. */
  const [hayEntrega, setHayEntrega] = useState(Boolean(entregaInicial));

  /* Los dos textos se guardan solos al salir del campo (la moneda, al
     cambiarla). `textosGuardados` es la última versión que la base confirmó:
     decide si hay algo que mandar y a qué se vuelve si falla. */
  const textosGuardados = useRef({
    min: pedidoMinStr.trim(),
    moneda: pedidoMinMoneda,
    nota: notaEntrega.trim(),
  });
  const { estado: estadoTextos, guardar: guardarConEstado } = useEstadoGuardado();
  const pedidoMinNum = pedidoMinStr.trim() ? parseFloat(pedidoMinStr.replace(",", ".")) : null;
  const pedidoMinMal = pedidoMinNum !== null && !(Number.isFinite(pedidoMinNum) && pedidoMinNum >= 0);

  /**
   * Los interruptores de recoger y domicilio guardan al momento, como los del
   * resto de Ajustes. Antes solo cambiaban en pantalla hasta pulsar «Guardar»
   * más abajo, con el mismo dibujo que los que sí guardaban: el dueño apagaba
   * el domicilio, cambiaba de sección y sus clientes seguían viéndolo.
   * Optimista y con vuelta atrás si el servidor dice que no.
   */
  async function alternarModo(clave: "recogida" | "domicilio") {
    if (cambiandoModo) return;
    const antes = clave === "recogida" ? recogida : domicilio;
    const fijar = clave === "recogida" ? setRecogida : setDomicilio;
    const siguiente = !antes;
    fijar(siguiente);
    setCambiandoModo(true);

    const parche: ParcheEntrega = {
      [clave]: siguiente,
      ...(hayEntrega ? {} : { costo: { modo: "consultar" }, tiempo: { min: 0, max: 0 } }),
    };
    const ok = await enviar(parche);
    setCambiandoModo(false);
    if (!ok) {
      fijar(antes);
      return;
    }
    setHayEntrega(true);
    toast.success(
      clave === "recogida"
        ? siguiente
          ? "Recogida activada: pueden pasar a buscar su pedido."
          : "Recogida desactivada."
        : siguiente
          ? "Entregas a domicilio activadas."
          : "Entregas a domicilio desactivadas.",
    );
  }

  /** Manda un parche de entrega. Devuelve si se guardó; los errores los avisa. */
  async function enviar(parche: ParcheEntrega): Promise<boolean> {
    try {
      const res = await fetch(`/api/places/${placeId}/entrega`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parche),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "No se pudo guardar. No se cambió nada.");
        return false;
      }
      return true;
    } catch {
      toast.error("No se pudo guardar. Revisa la conexión: no se cambió nada.");
      return false;
    }
  }

  /**
   * Las zonas también guardan al momento. El formulario de la hoja decía
   * «Añadir zona» o «Guardar cambios», pero solo tocaba la lista en pantalla,
   * y otro botón abajo guardaba de verdad: dos pasos donde el dueño veía uno.
   */
  async function guardarZonas(siguientes: ZonaEntrega[], aviso: string | null) {
    const ok = await enviar({
      costo:
        siguientes.length > 0
          ? { modo: "zonas", zonas: siguientes, moneda: siguientes[0]!.moneda }
          : { modo: "consultar" },
      ...(hayEntrega ? {} : { tiempo: { min: 0, max: 0 } }),
    });
    if (ok) {
      setHayEntrega(true);
      if (aviso) toast.success(aviso);
    }
    return ok;
  }

  /* ── Sheet de edición de zona ────────────────────────────────────────── */
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [zonaEditando, setZonaEditando] = useState<ZonaEntrega | null>(null);
  /* Campos del formulario de zona */
  const [znNombre, setZnNombre] = useState("");
  const [znMonto, setZnMonto] = useState("");
  const [znMoneda, setZnMoneda] = useState<string>("CUP");
  const [znActiva, setZnActiva] = useState(true);

  function abrirNuevaZona() {
    setZonaEditando(null);
    setZnNombre("");
    setZnMonto("");
    setZnMoneda("CUP");
    setZnActiva(true);
    setSheetAbierto(true);
  }

  function abrirEditarZona(zona: ZonaEntrega) {
    setZonaEditando(zona);
    setZnNombre(zona.nombre);
    setZnMonto(String(zona.monto));
    setZnMoneda(zona.moneda);
    setZnActiva(zona.activa);
    setSheetAbierto(true);
  }

  async function guardarZona() {
    if (guardando) return;
    const nombre = znNombre.trim().slice(0, 60);
    const monto = parseFloat(znMonto.replace(",", "."));
    if (!nombre || !Number.isFinite(monto) || monto < 0) {
      toast.error("El nombre y el costo son obligatorios.");
      return;
    }
    if (!zonaEditando && zonas.length >= MAX_ZONAS) {
      toast.error(`El máximo es ${MAX_ZONAS} zonas.`);
      return;
    }
    const siguientes = zonaEditando
      ? zonas.map((z) =>
          z.id === zonaEditando.id
            ? { ...z, nombre, monto, moneda: znMoneda, activa: znActiva }
            : z,
        )
      : [...zonas, { id: nuevoId(), nombre, monto, moneda: znMoneda, activa: znActiva }];

    setGuardando(true);
    const ok = await guardarZonas(siguientes, zonaEditando ? "Zona guardada." : "Zona añadida.");
    setGuardando(false);
    /* Si falla, la hoja se queda abierta con lo escrito: cerrarla perdería
       el formulario por un error de red. */
    if (!ok) return;
    setZonas(siguientes);
    setSheetAbierto(false);
  }

  /** Borra al momento, con «Deshacer» en el aviso: sin diálogo de por medio. */
  async function borrarZona(id: string) {
    if (guardando) return;
    const anteriores = zonas;
    const siguientes = zonas.filter((z) => z.id !== id);
    setZonas(siguientes);
    setGuardando(true);
    const ok = await guardarZonas(siguientes, null);
    setGuardando(false);
    if (!ok) {
      setZonas(anteriores);
      return;
    }
    toast("Zona borrada", {
      action: {
        label: "Deshacer",
        onClick: () => {
          setZonas(anteriores);
          void guardarZonas(anteriores, "Zona recuperada.");
        },
      },
    });
  }

  /* ── Guardar los textos ──────────────────────────────────────────────── */
  /** Un mínimo que no es número se marca y no se envía. */
  async function guardarTextos(moneda: string = pedidoMinMoneda) {
    if (pedidoMinMal) return;
    const siguiente = { min: pedidoMinStr.trim(), moneda, nota: notaEntrega.trim() };
    const previo = textosGuardados.current;
    if (
      previo.min === siguiente.min &&
      previo.moneda === siguiente.moneda &&
      previo.nota === siguiente.nota
    ) {
      return;
    }

    /* Solo los dos textos: los interruptores y las zonas ya se guardaron al
       tocarlos. `null` explícito: con el merge del servidor, una clave ausente
       se conserva, así que vaciar el mínimo o la nota tiene que viajar como
       «borra esto» y no como «no lo toques». */
    const ok = await guardarConEstado(() =>
      enviar({
        pedidoMinimo: pedidoMinNum !== null ? { monto: pedidoMinNum, moneda } : null,
        notaEntrega: siguiente.nota ? siguiente.nota.slice(0, 300) : null,
        ...(hayEntrega ? {} : { costo: { modo: "consultar" }, tiempo: { min: 0, max: 0 } }),
      }),
    );
    if (!ok) {
      setPedidoMinStr(previo.min);
      setPedidoMinMoneda(previo.moneda);
      setNotaEntrega(previo.nota);
      return;
    }
    setHayEntrega(true);
    textosGuardados.current = siguiente;
  }

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <>
      {/* La misma tarjeta que las otras secciones de Ajustes. Antes usaba
          `FormSection`, la del editor de la ficha, y con el plan bloqueado un
          «🔒» de emoji y ningún camino a Planes (`no-emoji-icons`,
          `icon-style-consistent` de ui-ux-pro-max). */}
      <section className="rounded-2xl border border-ink/5 bg-white p-gap-md">
        <h2 className="flex items-center gap-gap-xs font-lv-display text-body font-semibold text-ink">
          <MapPin size={18} strokeWidth={1.8} className="text-verde-600" aria-hidden />
          Domicilio y zonas
        </h2>
        <p className="mt-gap-xs max-w-[62ch] text-small text-ink-soft/75">
          Cómo reciben tus clientes el pedido, y cuánto cobras por llevarlo a cada barrio.
        </p>

      {bloqueo ? (
        <CandadoPlan onVerPlanes={onVerPlanes} texto={bloqueo} candadoEnTexto />
      ) : (
        <>
        {/* Guardan al tocarlos, como el resto de interruptores de Ajustes. */}
        <div className="mt-gap-md flex flex-col gap-gap-sm border-t border-ink/5 pt-gap-sm">
          <div className="flex items-center justify-between gap-gap-sm">
            <span className="text-small font-medium text-ink">Pueden pasar a recoger</span>
            <Switch
              tamano="sm"
              checked={recogida}
              onToggle={() => void alternarModo("recogida")}
              label="Pueden pasar a recoger"
              disabled={cambiandoModo}
            />
          </div>
          <div className="flex items-center justify-between gap-gap-sm">
            <span className="text-small font-medium text-ink">Hago entregas a domicilio</span>
            <Switch
              tamano="sm"
              checked={domicilio}
              onToggle={() => void alternarModo("domicilio")}
              label="Hago entregas a domicilio"
              disabled={cambiandoModo}
            />
          </div>
        </div>

        {/* ── Zonas ─────────────────────────────────────────────────────── */}
        {domicilio && (
          <div className="mt-gap-md flex flex-col gap-gap-sm">
            {zonas.length === 0 ? (
              <p className="text-small text-ink-soft/75">
                Todavía no tienes zonas. Añade los barrios a los que entregas y cuánto cobras.
              </p>
            ) : (
              <ul className="flex flex-col gap-[6px]">
                {zonas.map((zona) => (
                  <li
                    key={zona.id}
                    className="flex items-center gap-gap-sm rounded-xl border border-ink/5 bg-sand-deep px-gap-sm py-[10px]"
                  >
                    <MapPin size={15} strokeWidth={1.8} className="shrink-0 text-verde-600" />
                    <div className="min-w-0 flex-1">
                      <span className={cn("text-small font-semibold", !zona.activa && "text-ink-soft/75")}>
                        {zona.nombre}
                      </span>
                      <span className="ml-gap-xs text-meta text-ink-soft/75">
                        {zona.monto === 0 ? "Gratis" : fmtMonto(zona.monto, zona.moneda)}
                      </span>
                      {!zona.activa && (
                        <span className="ml-gap-xs text-meta text-ink-soft/75">· inactiva</span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={`Editar ${zona.nombre}`}
                      onClick={() => abrirEditarZona(zona)}
                      className="-my-1 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink-soft/75 transition-colors duration-300 ease-outquint hover:bg-white hover:text-ink"
                    >
                      <Pencil size={14} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Borrar ${zona.nombre}`}
                      onClick={() => void borrarZona(zona.id)}
                      disabled={guardando}
                      className="-my-1 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink-soft/75 transition-colors disabled:pointer-events-none disabled:opacity-50 duration-300 ease-outquint hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {zonas.length < MAX_ZONAS && (
              <button
                type="button"
                onClick={abrirNuevaZona}
                className="zonas-add-btn inline-flex h-11 w-fit cursor-pointer items-center gap-gap-xs rounded-full border border-dashed border-verde-300 px-gap-sm font-lv-display text-meta font-semibold text-verde-700 transition-colors duration-300 ease-outquint hover:border-verde-400 hover:bg-verde-50"
              >
                <Plus size={15} strokeWidth={2} />
                Añadir zona
              </button>
            )}
          </div>
        )}

        {/* ── Opcionales ────────────────────────────────────────────────── */}
        <div className="mt-gap-md flex flex-col gap-gap-md">
          <div className="flex items-end gap-gap-sm">
            <div className="flex-1">
              <Label htmlFor="pedidoMinimo">Pedido mínimo (opcional)</Label>
              <Input
                id="pedidoMinimo"
                type="text"
                inputMode="decimal"
                placeholder="p. ej. 500"
                value={pedidoMinStr}
                onChange={(e) => setPedidoMinStr(e.target.value)}
                onBlur={() => void guardarTextos()}
                aria-invalid={pedidoMinMal || undefined}
                className="mt-[4px]"
              />
            </div>
            <select
              value={pedidoMinMoneda}
              onChange={(e) => {
                setPedidoMinMoneda(e.target.value);
                void guardarTextos(e.target.value);
              }}
              aria-label="Moneda del pedido mínimo"
              className="zonas-select h-11 rounded-xl border border-ink/10 bg-white px-gap-sm text-small text-ink focus:border-verde-400 focus:outline-none sm:w-24"
            >
              {MONEDAS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="notaEntrega">Nota de entrega (opcional)</Label>
            <Input
              id="notaEntrega"
              type="text"
              placeholder="Entregamos de 10 a. m. a 6 p. m."
              value={notaEntrega}
              onChange={(e) => setNotaEntrega(e.target.value)}
              onBlur={() => void guardarTextos()}
              maxLength={300}
              className="mt-[4px]"
            />
          </div>
        </div>

        {pedidoMinMal && (
          <p className="mt-gap-xs text-meta text-destructive">
            Escribe un número válido en el pedido mínimo o déjalo vacío.
          </p>
        )}
        <div className="mt-gap-sm flex flex-wrap items-center justify-between gap-gap-sm">
          <p className="text-meta text-ink-soft/75">Se guarda al salir de cada campo.</p>
          <AvisoGuardado estado={estadoTextos} />
        </div>
        </>
      )}
      </section>

      {/* ── Sheet: añadir / editar zona ──────────────────────────────────── */}
      <Sheet open={sheetAbierto} onOpenChange={setSheetAbierto}>
        <SheetContent
          side="bottom"
          className="zonas-sheet mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl border-ink/5 p-gap-md"
        >
          <SheetHeader>
            <SheetTitle className="text-left">
              {zonaEditando ? "Editar zona" : "Nueva zona"}
            </SheetTitle>
            <SheetDescription className="text-left">
              El nombre que ven los clientes y cuánto cobras por llevar el pedido allí.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-gap-md flex flex-col gap-gap-md overflow-y-auto pb-safe">
            <div>
              <Label htmlFor="zn-nombre">Nombre del barrio o reparto</Label>
              <Input
                id="zn-nombre"
                type="text"
                placeholder="Vista Alegre, Reparto Sueño…"
                value={znNombre}
                onChange={(e) => setZnNombre(e.target.value)}
                maxLength={60}
                className="mt-[4px]"
                autoFocus
              />
            </div>

            <div className="flex items-end gap-gap-sm">
              <div className="flex-1">
                <Label htmlFor="zn-monto">Costo de envío (0 = gratis)</Label>
                <Input
                  id="zn-monto"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={znMonto}
                  onChange={(e) => setZnMonto(e.target.value)}
                  className="mt-[4px]"
                />
              </div>
              <select
                value={znMoneda}
                onChange={(e) => setZnMoneda(e.target.value)}
                aria-label="Moneda del costo"
                className="zonas-select h-11 rounded-xl border border-ink/10 bg-white px-gap-sm text-small text-ink focus:border-verde-400 focus:outline-none sm:w-24"
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-gap-sm">
              <span className="text-small text-ink">Zona activa</span>
              <Switch
                tamano="sm"
                checked={znActiva}
                onToggle={() => setZnActiva((v) => !v)}
                label="Zona activa"
              />
            </div>

            <button
              type="button"
              onClick={() => void guardarZona()}
              disabled={guardando}
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-gap-xs rounded-full bg-verde-400 font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-300 ease-outquint hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-60"
            >
              {guardando && <Loader2 size={16} strokeWidth={1.8} className="animate-spin" aria-hidden />}
              {guardando ? "Guardando…" : zonaEditando ? "Guardar cambios" : "Añadir zona"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

"use client";

/**
 * «Nueva oferta» en tres toques: producto, rebaja y duración.
 *
 * Es la versión corta del formulario de Ofertas (`ofertas-editor.tsx`), con
 * las mismas reglas: `validarOferta` (la que corre también en el servidor), el
 * precio rebajado tiene que ser menor que el de la carta, y el tope de ofertas
 * vigentes del plan (`ofertas_vigentes_max`). Empieza ahora mismo; para
 * programarla a otra hora está el formulario completo en Ofertas.
 *
 * Guarda con el mismo `PATCH` de la ficha (`ofertas: [...]`) que la pantalla de
 * Ofertas, y refresca el servidor para que la ficha pública la enseñe.
 */

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";
import { limiteDe, type Funcion } from "@/lib/plans";
import { parsePrecio, validarOferta } from "@/lib/ofertas";
import { estaAgotado } from "@/lib/disponibilidad";
import { useCatalogo } from "@/providers/catalogo-provider";
import { usePlaces } from "@/providers/places-provider";
import type { UserPlace } from "@/lib/places-store";
import { Label } from "@/components/ui/label";
import { INPUT_NATIVO_HOLGADO, TONO_CHAPITA } from "./ui/clases";
import { BotonPrimario } from "./ui/botones";

const HORA_MS = 3_600_000;
const DURACIONES = [
  { id: "hoy", label: "Hasta medianoche" },
  { id: "1d", label: "24 horas" },
  { id: "3d", label: "3 días" },
  { id: "7d", label: "7 días" },
] as const;
type Duracion = (typeof DURACIONES)[number]["id"];

function terminaDe(duracion: Duracion, ahora: number): number {
  if (duracion === "hoy") {
    const d = new Date(ahora);
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }
  const horas = duracion === "1d" ? 24 : duracion === "3d" ? 72 : 168;
  return ahora + horas * HORA_MS;
}

const claseOpcion = (elegida: boolean) =>
  clsx(
    "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-gap-md font-lv-display text-meta font-semibold transition-colors duration-500 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
    elegida
      ? TONO_CHAPITA.activa
      : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:text-verde-600",
  );

export function OfertaRapida({
  place,
  funciones,
  productoInicial,
  onHecho,
}: {
  place: UserPlace;
  funciones: Funcion[];
  /** «Poner en oferta» desde un producto: llega ya elegido. */
  productoInicial?: string;
  onHecho?: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const cat = useCatalogo();
  const { updatePlace } = usePlaces();
  const max = limiteDe(new Set(funciones), "ofertas_vigentes_max", cat);

  /* Solo lo que se puede pedir ahora: sin id no hay a qué apuntar, y ofertar lo
     agotado o lo oculto sería anunciar algo que no se vende. */
  const [ahora, setAhora] = useState(0);
  useEffect(() => setAhora(Date.now()), []);
  const productos = place.menu.filter(
    (p) => p.id && !p.oculto && !estaAgotado(p, ahora || Date.now()),
  );

  const [productoId, setProductoId] = useState(productoInicial ?? productos[0]?.id ?? "");
  const [modo, setModo] = useState<"pct" | "precio">("pct");
  const [valor, setValor] = useState("");
  const [duracion, setDuracion] = useState<Duracion>("hoy");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const existentes = place.ofertas ?? [];
  const enPie = ahora === 0 ? 0 : existentes.filter((o) => o.termina > ahora).length;
  const lleno = max !== null && enPie >= max;
  const producto = productos.find((p) => p.id === productoId);

  async function publicar() {
    if (guardando || !producto) return;
    const inicio = Math.floor(Date.now() / 60_000) * 60_000;
    const limpia = validarOferta({
      id: crypto.randomUUID(),
      productoId,
      titulo:
        modo === "pct" && valor ? `${valor} % en ${producto.name}` : `Oferta: ${producto.name}`,
      precioOferta: modo === "precio" ? valor : undefined,
      descuentoPct: modo === "pct" ? Number(valor) : undefined,
      inicia: inicio,
      termina: terminaDe(duracion, inicio),
    });
    if (typeof limpia === "string") {
      setError(limpia);
      return;
    }
    if (limpia.precioOferta) {
      const original = parsePrecio(producto.price);
      const rebajado = parsePrecio(limpia.precioOferta);
      if (original !== null && rebajado !== null && rebajado >= original) {
        setError(`El precio rebajado tiene que ser menor que el de la carta (${original}).`);
        return;
      }
    }
    setError(null);
    setGuardando(true);
    const ok = await updatePlace(place.id, { ofertas: [...existentes, limpia] });
    setGuardando(false);
    if (!ok) {
      setError("No se pudo publicar. Revisa la conexión: no se cambió nada.");
      return;
    }
    toast.success("Oferta publicada");
    router.refresh();
    onHecho?.();
  }

  if (lleno) {
    return (
      <p className="rounded-xl border border-lv-amber/40 bg-lv-amber/10 px-3 py-[7px] text-meta font-medium text-ink">
        Ya tienes {enPie} {enPie === 1 ? "oferta" : "ofertas"} en pie, el tope de tu plan. Quita
        alguna en «Ofertas flash» para publicar otra.
      </p>
    );
  }

  if (productos.length === 0) {
    return (
      <p className="text-small text-ink-soft/75">
        No hay productos disponibles en tu carta para ponerlos en oferta.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-gap-md">
      <div className="flex flex-col gap-gap-xs">
        <Label htmlFor={`${id}-producto`} className="font-lv-display">
          Producto
        </Label>
        <select
          id={`${id}-producto`}
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
          className={clsx(INPUT_NATIVO_HOLGADO, "cursor-pointer")}
        >
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.price ? ` · ${p.price} ${p.currency}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-gap-xs">
        <span className="font-lv-display text-small font-medium leading-none">Rebaja</span>
        <div role="group" aria-label="Tipo de rebaja" className="flex gap-gap-xs">
          <button
            type="button"
            aria-pressed={modo === "pct"}
            onClick={() => setModo("pct")}
            className={claseOpcion(modo === "pct")}
          >
            Porcentaje
          </button>
          <button
            type="button"
            aria-pressed={modo === "precio"}
            onClick={() => setModo("precio")}
            className={claseOpcion(modo === "precio")}
          >
            Precio nuevo
          </button>
        </div>
        <label htmlFor={`${id}-valor`} className="sr-only">
          {modo === "pct" ? "Descuento en porcentaje" : "Precio rebajado"}
        </label>
        <input
          id={`${id}-valor`}
          inputMode={modo === "pct" ? "numeric" : "decimal"}
          value={valor}
          maxLength={20}
          onChange={(e) => setValor(e.target.value)}
          placeholder={modo === "pct" ? "Ej: 20" : `Ej: menos de ${producto?.price ?? ""}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={INPUT_NATIVO_HOLGADO}
        />
      </div>

      <div className="flex flex-col gap-gap-xs">
        <span className="font-lv-display text-small font-medium leading-none">Cuánto dura</span>
        <div role="group" aria-label="Duración de la oferta" className="flex flex-wrap gap-gap-xs">
          {DURACIONES.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={duracion === d.id}
              onClick={() => setDuracion(d.id)}
              className={claseOpcion(duracion === d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-meta text-ink-soft/75">Empieza ahora mismo.</p>
      </div>

      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-ink"
        >
          {error}
        </p>
      )}

      <BotonPrimario onClick={() => void publicar()} disabled={guardando} className="w-full">
        {guardando && <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />}
        {guardando ? "Publicando…" : "Publicar oferta"}
      </BotonPrimario>
    </div>
  );
}

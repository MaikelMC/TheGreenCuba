"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, Save, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormSection } from "@/components/business/form-section";
import { MODULOS, PACKS, PACKS_ORDER, type ClaveModulo, type Pack } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";

interface PackAdmin {
  id: string;
  negocioId: string;
  negocioNombre: string;
  estado: string;
  serviciosSolicitados: string[];
  servicios: string[];
  funciones: string[];
  precioUsd: number | null;
  precioSugeridoUsd: number | null;
  oferta2x1: boolean;
  notaCliente: string | null;
  notaInterna: string | null;
  enviadoEn: string | null;
  pagadoEn: string | null;
  venceEn: string | null;
  creadoEn: string;
}

const SERVICIOS_MODULOS = Object.keys(MODULOS) as ClaveModulo[];
const SERVICIOS_PACKS = PACKS_ORDER as readonly Pack[];

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";
const AREA =
  "w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-small text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

/**
 * El editor de pack a medida para la página de administración de un negocio.
 *
 * Carga el pack en tramitación (si lo hay) y permite:
 * - Elegir servicios (módulos y packs estándar)
 * - Fijar precio final, oferta 2×1 y notas
 * - Guardar como borrador o enviarlo al dueño
 *
 * No se puede editar un pack pagado o vencido desde aquí.
 */
export function PackMedidaEditor({ placeId }: { placeId: string }) {
  const cat = useCatalogo();
  const [pack, setPack] = useState<PackAdmin | null | undefined>(undefined);
  const [servicios, setServicios] = useState<string[]>([]);
  const [precioTexto, setPrecioTexto] = useState("");
  const [oferta2x1, setOferta2x1] = useState(false);
  const [notaCliente, setNotaCliente] = useState("");
  const [notaInterna, setNotaInterna] = useState("");
  const [saving, setSaving] = useState<"borrador" | "enviado" | null>(null);

  const cargar = useCallback(() => {
    fetch(`/api/admin/packs-medida?placeId=${placeId}`)
      .then((r) => r.json())
      .then((d: { packs?: PackAdmin[] }) => {
        /* Mostrar el primero en tramitación. */
        const activo =
          d.packs?.find((p) =>
            ["solicitado", "borrador", "enviado"].includes(p.estado),
          ) ?? null;
        setPack(activo);
        if (activo) {
          setServicios(activo.servicios);
          setPrecioTexto(activo.precioUsd != null ? String(activo.precioUsd) : "");
          setOferta2x1(activo.oferta2x1);
          setNotaCliente(activo.notaCliente ?? "");
          setNotaInterna(activo.notaInterna ?? "");
        }
      })
      .catch(() => setPack(null));
  }, [placeId]);

  useEffect(() => { cargar(); }, [cargar]);

  const sugerido = pack?.precioSugeridoUsd;
  const precioFinal = Number(precioTexto.replace(",", "."));
  const precioValido = Number.isFinite(precioFinal) && precioFinal >= 0;

  function toggleServicio(clave: string) {
    setServicios((prev) =>
      prev.includes(clave) ? prev.filter((s) => s !== clave) : [...prev, clave],
    );
  }

  async function guardar(nuevoEstado: "borrador" | "enviado") {
    if (saving) return;
    if (!precioValido) {
      toast.error("El precio no es válido.");
      return;
    }
    setSaving(nuevoEstado);
    try {
      let res: Response;
      const body = {
        servicios,
        precioUsd: precioFinal,
        oferta2x1,
        notaCliente: notaCliente.trim() || null,
        notaInterna: notaInterna.trim() || null,
        estado: nuevoEstado,
      };

      if (pack) {
        /* Pack existente: PATCH. */
        res = await fetch(`/api/admin/packs-medida/${pack.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        /* Sin pack pendiente: crear borrador. */
        res = await fetch("/api/admin/packs-medida", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ negocioId: placeId, ...body }),
        });
      }

      const data = (await res.json().catch(() => null)) as {
        pack?: PackAdmin;
        error?: string;
      } | null;

      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo guardar.");
        return;
      }

      toast.success(
        nuevoEstado === "enviado"
          ? "Pack enviado al dueño. Ya puede pagarlo."
          : "Borrador guardado.",
      );
      cargar();
    } catch {
      toast.error("No hubo respuesta del servidor.");
    } finally {
      setSaving(null);
    }
  }

  if (pack === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-ink-soft/40" />
      </div>
    );
  }

  const soloLectura = pack?.estado === "enviado";

  return (
    <FormSection title="Pack a medida" icon={<Package size={18} strokeWidth={1.8} />}>
      {pack && (
        <p className="text-meta text-ink-soft/75">
          Estado:{" "}
          <span className="font-semibold text-ink capitalize">{pack.estado}</span>
          {pack.estado === "enviado" && (
            <> · Enviado al dueño — puede pagarlo desde su panel.</>
          )}
        </p>
      )}

      {!pack && (
        <p className="text-small text-ink-soft/60">
          Este negocio no tiene un pack en tramitación. Puedes crear uno directamente.
        </p>
      )}

      {/* Servicios solicitados por el dueño (readonly). */}
      {pack && pack.serviciosSolicitados.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-meta font-semibold text-amber-700">El dueño pidió:</p>
          <p className="mt-[2px] text-small text-amber-800">
            {pack.serviciosSolicitados.join(" · ")}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-gap-xs">
        <span className={LABEL}>Módulos incluidos</span>
        <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-2">
          {SERVICIOS_MODULOS.map((clave) => (
            <label key={clave} className={cn("flex cursor-pointer items-center gap-gap-xs text-small text-ink", soloLectura && "cursor-default opacity-60")}>
              <input
                type="checkbox"
                checked={servicios.includes(clave)}
                onChange={() => !soloLectura && toggleServicio(clave)}
                disabled={soloLectura}
                className="size-4 shrink-0 accent-verde-500"
              />
              {cat.modulos[clave].nombre}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-gap-xs">
        <span className={LABEL}>Packs estándar</span>
        <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-2">
          {SERVICIOS_PACKS.map((clave) => (
            <label key={clave} className={cn("flex cursor-pointer items-center gap-gap-xs text-small text-ink", soloLectura && "cursor-default opacity-60")}>
              <input
                type="checkbox"
                checked={servicios.includes(clave)}
                onChange={() => !soloLectura && toggleServicio(clave)}
                disabled={soloLectura}
                className="size-4 shrink-0 accent-verde-500"
              />
              {cat.packs[clave].nombre}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-gap-md sm:grid-cols-2">
        <div className="flex flex-col gap-gap-xs">
          <label htmlFor="pmPrecio" className={LABEL}>
            Precio final (USD){sugerido != null && ` · sugerido: ${sugerido}`}
          </label>
          <input
            id="pmPrecio"
            type="number"
            min={0}
            step={0.5}
            value={precioTexto}
            onChange={(e) => !soloLectura && setPrecioTexto(e.target.value)}
            readOnly={soloLectura}
            placeholder="0"
            className={cn(INPUT, soloLectura && "opacity-60")}
          />
        </div>

        <div className="flex items-end">
          <label className={cn("flex cursor-pointer items-center gap-gap-xs text-small text-ink", soloLectura && "cursor-default opacity-60")}>
            <input
              type="checkbox"
              checked={oferta2x1}
              onChange={(e) => !soloLectura && setOferta2x1(e.target.checked)}
              disabled={soloLectura}
              className="size-4 accent-verde-500"
            />
            Oferta 2×1 (primer pago = 2 meses)
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-gap-xs">
        <label htmlFor="pmNotaCliente" className={LABEL}>Nota para el dueño</label>
        <textarea
          id="pmNotaCliente"
          rows={2}
          value={notaCliente}
          onChange={(e) => !soloLectura && setNotaCliente(e.target.value)}
          readOnly={soloLectura}
          placeholder="Una línea que explique qué incluye o cuándo arranca…"
          className={cn(AREA, soloLectura && "opacity-60")}
        />
      </div>

      <div className="flex flex-col gap-gap-xs">
        <label htmlFor="pmNotaInterna" className={LABEL}>Nota interna</label>
        <textarea
          id="pmNotaInterna"
          rows={2}
          value={notaInterna}
          onChange={(e) => setNotaInterna(e.target.value)}
          placeholder="Solo para administración — no la ve el dueño."
          className={AREA}
        />
      </div>

      {!soloLectura && (
        <div className="flex flex-wrap gap-gap-sm">
          <button
            type="button"
            onClick={() => void guardar("borrador")}
            disabled={saving !== null}
            className="inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving === "borrador" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} strokeWidth={1.8} />
            )}
            Guardar borrador
          </button>

          <button
            type="button"
            onClick={() => void guardar("enviado")}
            disabled={saving !== null || !precioFinal}
            className="inline-flex h-11 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving === "enviado" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} strokeWidth={1.8} />
            )}
            Enviar al dueño
          </button>
        </div>
      )}
    </FormSection>
  );
}

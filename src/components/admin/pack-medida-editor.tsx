"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, Save, Send, Undo2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormSection } from "@/components/business/form-section";
import { MODULOS, PACKS, PACKS_ORDER, type ClaveModulo, type Pack } from "@/lib/plans";
import { nombreServicio } from "@/lib/pack-medida";
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

const BOTON_SECUNDARIO =
  "inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700 disabled:cursor-not-allowed disabled:opacity-60";
/* Mismo contorno que «Quitar dueño» en `vinculo-editor.tsx`. */
const BOTON_PELIGRO =
  "inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition duration-500 ease-outquint hover:border-destructive/30 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60";

/**
 * El editor de pack a medida para la página de administración de un negocio.
 *
 * Carga el pack en tramitación (si lo hay) o el pagado que sigue vigente y
 * permite:
 * - Elegir servicios (módulos y packs estándar)
 * - Fijar precio final, oferta 2×1 y notas
 * - Guardar como borrador o enviarlo al dueño
 *
 * El pack pagado se muestra en solo lectura: su vigencia la fija el pago y no
 * se edita desde aquí. Sin uno vigente ni uno en tramitación se puede crear.
 */
export function PackMedidaEditor({ placeId }: { placeId: string }) {
  const cat = useCatalogo();
  const [pack, setPack] = useState<PackAdmin | null | undefined>(undefined);
  const [servicios, setServicios] = useState<string[]>([]);
  const [precioTexto, setPrecioTexto] = useState("");
  const [oferta2x1, setOferta2x1] = useState(false);
  const [notaCliente, setNotaCliente] = useState("");
  const [notaInterna, setNotaInterna] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  const cargar = useCallback(() => {
    fetch(`/api/admin/packs-medida?placeId=${encodeURIComponent(placeId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { packs?: PackAdmin[] }) => {
        /* Primero lo que hay que atender; si no, el pack pagado que sigue
           vigente, para que no desaparezca de la ficha al cobrarse. */
        const activo =
          d.packs?.find((p) =>
            ["solicitado", "borrador", "enviado"].includes(p.estado),
          ) ??
          d.packs?.find(
            (p) =>
              p.estado === "pagado" &&
              p.venceEn !== null &&
              new Date(p.venceEn).getTime() > Date.now(),
          ) ??
          null;
        setFallo(false);
        setPack(activo);
        /* Con o sin pack: tras cancelar o rechazar, el formulario vuelve vacío
           para crear uno nuevo, no con los datos del que se cerró. */
        setServicios(activo?.servicios ?? []);
        setPrecioTexto(activo?.precioUsd != null ? String(activo.precioUsd) : "");
        setOferta2x1(activo?.oferta2x1 ?? false);
        setNotaCliente(activo?.notaCliente ?? "");
        setNotaInterna(activo?.notaInterna ?? "");
      })
      /* Un fallo de carga **no** se enseña como «no hay pack»: invitaba a crear
         otro sobre uno que sí existía. */
      .catch(() => setFallo(true));
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

  /** Un `PATCH`/`POST` y su aviso. `clave` marca qué botón gira. */
  async function enviar(
    clave: string,
    body: Record<string, unknown>,
    exito: string,
  ): Promise<void> {
    if (saving) return;
    setSaving(clave);
    try {
      const res = pack
        ? await fetch(`/api/admin/packs-medida/${pack.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/packs-medida", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ negocioId: placeId, ...body }),
          });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo guardar. No se cambió nada.");
        return;
      }
      toast.success(exito);
      cargar();
    } catch {
      toast.error("No hubo respuesta del servidor. No se cambió nada.");
    } finally {
      setSaving(null);
    }
  }

  function guardar(nuevoEstado: "borrador" | "enviado") {
    if (!precioValido) {
      toast.error("El precio no es válido.");
      return;
    }
    void enviar(
      nuevoEstado,
      {
        servicios,
        precioUsd: precioFinal,
        oferta2x1,
        notaCliente: notaCliente.trim() || null,
        notaInterna: notaInterna.trim() || null,
        estado: nuevoEstado,
      },
      nuevoEstado === "enviado"
        ? "Pack enviado al dueño. Ya puede pagarlo."
        : "Borrador guardado.",
    );
  }

  /** Cerrar el pack (cancelar o rechazar). Pide confirmación: no se reabre. */
  function cerrar(estado: "cancelado" | "rechazado", pregunta: string, exito: string) {
    if (!window.confirm(pregunta)) return;
    void enviar(estado, { estado }, exito);
  }

  if (fallo) {
    return (
      <FormSection title="Pack a medida" icon={<Package size={18} strokeWidth={1.8} />}>
        <p role="alert" className="text-meta font-semibold text-destructive-ink">
          No se pudo cargar el pack. Recarga la página antes de crear o editar uno.
        </p>
      </FormSection>
    );
  }

  if (pack === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Loader2
          size={20}
          className="animate-spin text-ink-soft/40"
          aria-label="Cargando el pack a medida"
        />
      </div>
    );
  }

  const vigente = Boolean(
    pack?.estado === "pagado" &&
      pack.venceEn !== null &&
      new Date(pack.venceEn).getTime() > Date.now(),
  );
  const soloLectura = pack?.estado === "enviado" || vigente;

  /* Hay cambios sin guardar si el formulario difiere del pack cargado (o, sin
     pack, si ya se escribió algo). Lo lee la página para avisar antes de salir. */
  const sinGuardar =
    JSON.stringify([servicios, precioTexto, oferta2x1, notaCliente, notaInterna]) !==
    JSON.stringify([
      pack?.servicios ?? [],
      pack?.precioUsd != null ? String(pack.precioUsd) : "",
      pack?.oferta2x1 ?? false,
      pack?.notaCliente ?? "",
      pack?.notaInterna ?? "",
    ]);

  return (
    <FormSection title="Pack a medida" icon={<Package size={18} strokeWidth={1.8} />}>
      {/* Marca que lee la página de edición antes de navegar fuera. */}
      {sinGuardar && <span data-sin-guardar="pack" hidden />}
      {pack && (
        <p className="text-meta text-ink-soft/75">
          Estado:{" "}
          <span className="font-semibold text-ink capitalize">{pack.estado}</span>
          {pack.estado === "enviado" && (
            <> · Enviado al dueño: puede pagarlo desde su panel.</>
          )}
          {vigente && pack.venceEn && (
            <>
              {" "}
              · Activo hasta el{" "}
              {new Date(pack.venceEn).toLocaleDateString("es-CU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {pack.precioUsd !== null && ` · ${pack.precioUsd} USD/mes`}
            </>
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
        <div className="rounded-xl border border-lv-amber/40 bg-lv-amber/10 px-4 py-3">
          <p className="text-meta font-semibold text-ink">El dueño pidió:</p>
          <p className="mt-[2px] text-small text-ink">
            {pack.serviciosSolicitados
              .map((clave) => nombreServicio(clave, cat))
              .join(" · ")}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-gap-xs">
        <span className={LABEL}>Módulos incluidos</span>
        <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-2">
          {SERVICIOS_MODULOS.map((clave) => (
            <label key={clave} className={cn("flex min-h-11 cursor-pointer items-center gap-gap-xs text-small text-ink", soloLectura && "cursor-default opacity-60")}>
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
            <label key={clave} className={cn("flex min-h-11 cursor-pointer items-center gap-gap-xs text-small text-ink", soloLectura && "cursor-default opacity-60")}>
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
          <label className={cn("flex min-h-11 cursor-pointer items-center gap-gap-xs text-small text-ink", soloLectura && "cursor-default opacity-60")}>
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
          readOnly={vigente}
          placeholder="Solo para administración. El dueño no la ve."
          className={cn(AREA, vigente && "opacity-60")}
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
            /* Sin servicios el dueño pagaría un pack que no da nada. */
            disabled={saving !== null || !precioFinal || servicios.length === 0}
            className="inline-flex h-11 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving === "enviado" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} strokeWidth={1.8} />
            )}
            Enviar al dueño
          </button>

          {pack && (
            <button
              type="button"
              onClick={() =>
                pack.estado === "solicitado"
                  ? cerrar(
                      "rechazado",
                      "¿Rechazar la solicitud del dueño? No se puede deshacer; podrás crear un pack nuevo.",
                      "Solicitud rechazada.",
                    )
                  : cerrar(
                      "cancelado",
                      "¿Descartar este borrador? No se puede deshacer.",
                      "Borrador descartado.",
                    )
              }
              disabled={saving !== null}
              className={BOTON_PELIGRO}
            >
              {saving === "rechazado" || saving === "cancelado" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <XCircle size={15} strokeWidth={1.8} />
              )}
              {pack.estado === "solicitado" ? "Rechazar solicitud" : "Descartar borrador"}
            </button>
          )}
        </div>
      )}

      {/* Enviado: el dueño puede estar pagándolo, así que los datos no se
          tocan. Lo que sí se puede: devolverlo a borrador para corregirlo,
          cancelarlo, o apuntar la nota interna (que el dueño no ve). */}
      {soloLectura && pack && pack.estado === "enviado" && (
        <div className="flex flex-wrap gap-gap-sm">
          <button
            type="button"
            onClick={() =>
              void enviar(
                "nota",
                { notaInterna: notaInterna.trim() },
                "Nota interna guardada.",
              )
            }
            disabled={saving !== null || notaInterna === (pack.notaInterna ?? "")}
            className={BOTON_SECUNDARIO}
          >
            {saving === "nota" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} strokeWidth={1.8} />
            )}
            Guardar nota interna
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "¿Devolver a borrador? Se abre una copia para corregirla y el dueño deja de poder pagar este. Si ya había abierto el pago y lo completa, se activa lo que se le envió, no la corrección.",
                )
              ) {
                void enviar("borrador", { estado: "borrador" }, "Pack devuelto a borrador.");
              }
            }}
            disabled={saving !== null}
            className={BOTON_SECUNDARIO}
          >
            {saving === "borrador" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Undo2 size={15} strokeWidth={1.8} />
            )}
            Devolver a borrador
          </button>

          <button
            type="button"
            onClick={() =>
              cerrar(
                "cancelado",
                "¿Cancelar el pack enviado? No se puede deshacer. Si el dueño ya había abierto el pago y lo completa, el pack se activa igual: es dinero cobrado.",
                "Pack cancelado.",
              )
            }
            disabled={saving !== null}
            className={BOTON_PELIGRO}
          >
            {saving === "cancelado" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <XCircle size={15} strokeWidth={1.8} />
            )}
            Cancelar pack
          </button>
        </div>
      )}

      {vigente && (
        <p className="rounded-xl border border-verde-200 bg-verde-50/60 px-4 py-3 text-meta text-ink-soft/80">
          Este pack ya está pagado y vigente. No se edita desde aquí: su precio,
          servicios y fecha de fin quedaron fijados al cobrarse. Cuando venza
          podrás preparar uno nuevo.
        </p>
      )}
    </FormSection>
  );
}

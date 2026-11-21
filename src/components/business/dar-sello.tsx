"use client";

/**
 * Dar un sello a mano: el flujo de «Clientes frecuentes», en una pieza que se
 * usa en tres sitios (la acción rápida de Hoy, el «Sello a mano» de un pedido y
 * la propia pantalla de Clientes).
 *
 * - **Por teléfono:** mientras se escribe se buscan las tarjetas que coinciden
 *   (nombre o teléfono). Tocar una suma su sello con `sellarClienteExistente`
 *   (`POST …/clientes-frecuentes/{id}/sello`) y el aviso trae «Deshacer» 6 s.
 *   Si no hay tarjeta, el botón da el sello a ese número con `sellarAMano`
 *   (`POST …/fidelidad/sello`), que crea la tarjeta.
 * - **Por código del pedido:** `sellarAMano` con el código; pasa por el mismo
 *   camino que marcar entregado y no suma dos veces.
 *
 * Las comprobaciones (compra mínima, duplicado, sin teléfono) son las del
 * servidor; aquí solo se cuentan.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Stamp } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";
import { INPUT_NATIVO_HOLGADO, TONO_CHAPITA } from "./ui/clases";
import { BotonPrimario } from "./ui/botones";

interface Coincidencia {
  clienteId: string;
  nombre: string | null;
  telefonoEnmascarado: string;
  sellos: number;
  metaSellos: number;
  premioListo: string | null;
}

async function textoError(res: Response, porDefecto: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? porDefecto;
}

export function DarSello({
  placeId,
  telefonoInicial = "",
  onHecho,
}: {
  placeId: string;
  telefonoInicial?: string;
  /** Tras sumar (o deshacer): para recargar listas o cerrar la hoja. */
  onHecho?: () => void;
}) {
  const id = useId();
  const [modo, setModo] = useState<"telefono" | "codigo">("telefono");
  const [valor, setValor] = useState(telefonoInicial);
  const [nota, setNota] = useState("");
  const [coincidencias, setCoincidencias] = useState<Coincidencia[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const peticion = useRef(0);

  /* Búsqueda mientras se escribe, con 300 ms de espera: cada tecla no puede
     ser una petición en datos móviles. */
  useEffect(() => {
    if (modo !== "telefono") return;
    const q = valor.trim();
    if (q.length < 2) {
      setCoincidencias([]);
      return;
    }
    const esta = ++peticion.current;
    const t = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(
          `/api/places/${placeId}/clientes-frecuentes?q=${encodeURIComponent(q)}`,
        );
        if (esta !== peticion.current || !res.ok) return;
        const data = (await res.json()) as { clientes?: Coincidencia[] };
        setCoincidencias((data.clientes ?? []).slice(0, 5));
      } catch {
        /* Sin red, sin sugerencias: se puede dar el sello al número igual. */
      } finally {
        if (esta === peticion.current) setBuscando(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [valor, modo, placeId]);

  async function deshacer(clienteId: string, movimientoId: string) {
    try {
      const res = await fetch(
        `/api/places/${placeId}/clientes-frecuentes/${clienteId}/sello`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ movimientoId }),
        },
      );
      if (!res.ok) {
        toast.error("No se pudo deshacer.");
        return;
      }
      toast.success("Sello deshecho.");
      onHecho?.();
    } catch {
      toast.error("No se pudo deshacer. Revisa la conexión.");
    }
  }

  async function sellarCliente(c: Coincidencia) {
    if (ocupado) return;
    setOcupado(true);
    try {
      const res = await fetch(`/api/places/${placeId}/clientes-frecuentes/${c.clienteId}/sello`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error(await textoError(res, "No se pudo dar el sello."));
        return;
      }
      const data = (await res.json().catch(() => null)) as { movimientoId?: string } | null;
      const movimientoId = data?.movimientoId ?? "";
      toast.success(`+1 sello para ${c.nombre?.trim() || c.telefonoEnmascarado}`, {
        duration: 6000,
        action: movimientoId
          ? { label: "Deshacer", onClick: () => void deshacer(c.clienteId, movimientoId) }
          : undefined,
      });
      setValor("");
      setCoincidencias([]);
      onHecho?.();
    } catch {
      toast.error("No se pudo dar el sello. Revisa la conexión.");
    } finally {
      setOcupado(false);
    }
  }

  async function sellarAMano() {
    if (ocupado) return;
    const limpio = valor.trim();
    if (!limpio) {
      toast.error(modo === "telefono" ? "Escribe el teléfono." : "Escribe el código del pedido.");
      return;
    }
    setOcupado(true);
    try {
      const res = await fetch(`/api/places/${placeId}/fidelidad/sello`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          modo === "telefono" ? { telefono: limpio, nota: nota.trim() || null } : { codigo: limpio },
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
      if (estado === "sumado") toast.success("Sello sumado.");
      else if (estado === "duplicado") toast.info("Ese pedido ya tenía su sello.");
      else if (estado === "sin_comprobar") toast.info("No se pudo comprobar la compra mínima.");
      else if (estado === "bajo_minimo") toast.info("El pedido no llega a la compra mínima.");
      else if (estado === "sin_telefono") toast.info("Ese pedido no tiene teléfono.");
      else toast.info("No se sumó el sello.");
      setValor("");
      setNota("");
      setCoincidencias([]);
      onHecho?.();
    } catch {
      toast.error("No se pudo dar el sello. Revisa la conexión.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-gap-sm">
      <div role="group" aria-label="Cómo buscar al cliente" className="flex gap-gap-xs">
        {(["telefono", "codigo"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={modo === m}
            onClick={() => {
              setModo(m);
              setValor("");
              setCoincidencias([]);
            }}
            className={clsx(
              "inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border font-lv-display text-meta font-semibold transition-colors duration-500 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
              modo === m
                ? TONO_CHAPITA.activa
                : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:text-verde-600",
            )}
          >
            {m === "telefono" ? "Por teléfono o nombre" : "Por código del pedido"}
          </button>
        ))}
      </div>

      <label htmlFor={`${id}-valor`} className="sr-only">
        {modo === "telefono" ? "Teléfono o nombre del cliente" : "Código del pedido"}
      </label>
      <input
        id={`${id}-valor`}
        type="text"
        inputMode={modo === "telefono" ? "tel" : "text"}
        autoComplete="off"
        value={valor}
        maxLength={modo === "telefono" ? 40 : 20}
        onChange={(e) =>
          setValor(
            modo === "codigo"
              ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
              : e.target.value,
          )
        }
        placeholder={modo === "telefono" ? "+53 5 123 4567 o un nombre" : "Código #XXXXX"}
        className={INPUT_NATIVO_HOLGADO}
      />

      {modo === "telefono" && (buscando || coincidencias.length > 0) && (
        <ul className="flex flex-col gap-gap-xs" aria-live="polite">
          {buscando && coincidencias.length === 0 && (
            <li className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
              <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
              Buscando tarjetas…
            </li>
          )}
          {coincidencias.map((c) => (
            <li key={c.clienteId}>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void sellarCliente(c)}
                className="flex min-h-11 w-full cursor-pointer items-center gap-gap-sm rounded-2xl border border-ink/10 bg-white px-gap-md py-gap-xs text-left transition-colors duration-500 ease-outquint hover:border-verde-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40 disabled:pointer-events-none disabled:opacity-60"
              >
                <Stamp size={18} strokeWidth={1.8} className="shrink-0 text-verde-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-lv-display text-small font-semibold text-ink">
                    {c.nombre?.trim() || c.telefonoEnmascarado}
                  </span>
                  <span className="block text-meta text-ink-soft/75">
                    {c.sellos} de {c.metaSellos} sellos
                    {c.premioListo ? ` · premio listo: ${c.premioListo}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-lv-display text-meta font-semibold text-verde-700">
                  +1 sello
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {modo === "telefono" && (
        <>
          <label htmlFor={`${id}-nota`} className="sr-only">
            Nota del sello
          </label>
          <input
            id={`${id}-nota`}
            type="text"
            value={nota}
            maxLength={300}
            placeholder="Nota (opcional)"
            onChange={(e) => setNota(e.target.value)}
            className={INPUT_NATIVO_HOLGADO}
          />
        </>
      )}

      <BotonPrimario onClick={() => void sellarAMano()} disabled={ocupado} className="w-full">
        {ocupado && <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />}
        {modo === "telefono" ? "Dar sello a este número" : "Dar sello por el código"}
      </BotonPrimario>
      <p className="text-meta text-ink-soft/75">
        {modo === "telefono"
          ? "Si el número no tiene tarjeta, se le crea. Si ya la tiene, mejor tócala arriba: así puedes deshacer."
          : "Pasa por el mismo camino que marcar el pedido entregado: no suma dos veces."}
      </p>
    </div>
  );
}

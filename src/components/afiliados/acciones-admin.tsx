"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

async function accion(datos: Record<string, unknown>): Promise<boolean> {
  const r = await fetch("/api/admin/afiliados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  }).catch(() => null);
  if (r?.ok) return true;
  const data = (await r?.json().catch(() => null)) as { error?: string } | null;
  toast.error(data?.error ?? "No se pudo guardar. Inténtalo de nuevo.");
  return false;
}

const boton =
  "rounded-full px-3 py-1.5 font-lv-display text-meta font-semibold transition-colors disabled:opacity-50";

/** «Pagado» / «Rechazar» de un cobro pedido. El rechazo pide un motivo en la misma fila. */
export function ResolverCobro({ id }: { id: string }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function resolver(estado: "pagado" | "rechazado") {
    if (estado === "rechazado" && !nota.trim()) {
      toast.error("Escribe el motivo del rechazo.");
      return;
    }
    setOcupado(true);
    if (await accion({ accion: "cobro", id, estado, nota })) {
      toast.success(estado === "pagado" ? "Cobro marcado como pagado." : "Cobro rechazado.");
      router.refresh();
    }
    setOcupado(false);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        id={`nota-cobro-${id}`}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Comprobante o motivo"
        className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-sand-warm px-2 py-1.5 text-meta"
      />
      <button type="button" disabled={ocupado} onClick={() => resolver("pagado")} className={`${boton} bg-verde-600 text-white hover:bg-verde-700`}>
        Pagado
      </button>
      <button type="button" disabled={ocupado} onClick={() => resolver("rechazado")} className={`${boton} bg-sand-deep text-ink hover:bg-sand`}>
        Rechazar
      </button>
    </div>
  );
}

export function EntregarPremio({ afiliadoId, tipo }: { afiliadoId: string; tipo: "bono" | "recarga_internacional" }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        if (await accion({ accion: "premio", afiliadoId, tipo })) {
          toast.success("Premio marcado como entregado.");
          router.refresh();
        }
        setOcupado(false);
      }}
      className={`${boton} bg-verde-600 text-white hover:bg-verde-700`}
    >
      Entregado
    </button>
  );
}

/** Quita el código de referido del afiliado (ya no puede traer nuevos negocios). */
export function QuitarAfiliacion({ afiliadoId, nombre }: { afiliadoId: string; nombre: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  if (!confirmar) {
    return (
      <button
        type="button"
        onClick={() => setConfirmar(true)}
        className={`${boton} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
      >
        Quitar afiliación
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
      <span className="text-meta text-red-800">¿Quitar a {nombre}?</span>
      <button
        type="button"
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          if (await accion({ accion: "quitar_afiliacion", afiliadoId })) {
            toast.success("Afiliación eliminada.");
            router.refresh();
          }
          setOcupado(false);
          setConfirmar(false);
        }}
        className={`${boton} bg-red-600 text-white hover:bg-red-700`}
      >
        Confirmar
      </button>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => setConfirmar(false)}
        className={`${boton} bg-white text-ink hover:bg-sand`}
      >
        Cancelar
      </button>
    </div>
  );
}

export function NuevaNota({ afiliadoId }: { afiliadoId: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setOcupado(true);
        if (await accion({ accion: "nota", afiliadoId, texto })) {
          setTexto("");
          router.refresh();
        }
        setOcupado(false);
      }}
    >
      <label htmlFor="nota-afiliado" className="text-meta font-semibold text-ink">
        Añadir nota
      </label>
      <textarea
        id="nota-afiliado"
        required
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ej.: habló con 3 cafeterías de Enramadas, vuelve el lunes."
        className="min-h-20 rounded-xl border border-ink/10 bg-sand-warm p-3 text-small"
      />
      <button type="submit" disabled={ocupado} className={`${boton} self-start bg-verde-600 text-white hover:bg-verde-700`}>
        Guardar nota
      </button>
    </form>
  );
}

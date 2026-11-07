"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * El afiliado pide cobrar todo lo disponible. El importe lo calcula el servidor;
 * aquí solo se elige el método y se escribe a dónde pagarle.
 */
export function PedirCobro({ disponibleCup, minimoCup, hayPedido }: { disponibleCup: number; minimoCup: number; hayPedido: boolean }) {
  const router = useRouter();
  const [metodo, setMetodo] = useState("saldo");
  const [destino, setDestino] = useState("");
  const [enviando, setEnviando] = useState(false);
  const puede = !hayPedido && disponibleCup >= minimoCup;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const r = await fetch("/api/afiliados/cobros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metodo, destino }),
    }).catch(() => null);
    const data = (await r?.json().catch(() => null)) as { error?: string; cup?: number } | null;
    setEnviando(false);
    if (!r?.ok) {
      toast.error(data?.error ?? "No se pudo pedir el cobro. Inténtalo de nuevo.");
      return;
    }
    toast.success("Cobro pedido. Te pagamos entre el día 1 y el 5 del mes.");
    setDestino("");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-gap-sm">
      <div className="grid gap-gap-sm sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-meta font-semibold text-ink">
          Cómo quieres cobrar
          <select
            id="cobro-metodo"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            className="rounded-xl border border-ink/10 bg-sand-warm px-3 py-2.5 text-small font-normal"
          >
            <option value="saldo">Saldo móvil</option>
            <option value="transferencia_cup">Transferencia en CUP</option>
            <option value="cubapay">CubaPay</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-meta font-semibold text-ink">
          Número de teléfono o tarjeta
          <input
            id="cobro-destino"
            inputMode="numeric"
            required
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="5XXXXXXX"
            className="rounded-xl border border-ink/10 bg-sand-warm px-3 py-2.5 text-small font-normal"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={!puede || enviando}
        className="rounded-full bg-verde-600 px-gap-md py-2.5 font-lv-display text-small font-semibold text-white transition-colors hover:bg-verde-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? "Pidiendo…" : "Pedir cobro de todo lo disponible"}
      </button>
      <p className="text-meta text-ink-soft/70">
        {hayPedido
          ? "Ya tienes un cobro pedido. Te lo pagamos entre el día 1 y el 5 del mes."
          : `Mínimo ${minimoCup} CUP. Pagamos del día 1 al 5 de cada mes.`}
      </p>
    </form>
  );
}

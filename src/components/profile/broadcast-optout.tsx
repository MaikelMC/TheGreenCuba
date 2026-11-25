"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellOff } from "lucide-react";

/** La baja de los avisos de administración, en la bandeja del usuario. */
export function BroadcastOptOut() {
  const [optOut, setOptOut] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/notifications/preferences")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: { broadcastOptOut?: boolean }) => {
        if (vivo) setOptOut(Boolean(data.broadcastOptOut));
      })
      .catch(() => {
        if (vivo) setOptOut(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function cambiar(siguiente: boolean) {
    setGuardando(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcastOptOut: siguiente }),
      });
      if (!res.ok) throw new Error();
      setOptOut(siguiente);
      toast.success(
        siguiente
          ? "No recibirás más avisos de administración."
          : "Volverás a recibir avisos de administración.",
      );
    } catch {
      toast.error("No se pudo guardar la preferencia.");
    } finally {
      setGuardando(false);
    }
  }

  if (optOut === null) return null;

  return (
    <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-ink/10 bg-white/70 px-4 py-3 text-small text-ink">
      <BellOff size={16} strokeWidth={1.8} className="shrink-0 text-ink-soft" />
      <span className="flex-1">No recibir avisos de administración</span>
      <input
        type="checkbox"
        checked={optOut}
        disabled={guardando}
        onChange={(event) => void cambiar(event.target.checked)}
        className="size-4 shrink-0 accent-verde-600"
      />
    </label>
  );
}

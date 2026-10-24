"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";

import { usePlaces } from "@/providers/places-provider";

/**
 * Fecha del catálogo y botón para volver a pedirlo.
 *
 * No depende de pull-to-refresh: el gesto no existe en la app instalada y no es
 * descubrible. Aquí el botón está siempre visible y, sin red, dice por qué no
 * puede hacer nada en vez de quedarse mudo.
 */
function haceCuanto(timestamp: number): string {
  const minutos = Math.round((Date.now() - timestamp) / 60_000);
  if (minutos < 1) return "ahora mismo";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
}

export function CatalogSync() {
  const { lastSyncedAt, fromCache, refreshPlaces } = usePlaces();
  const [actualizando, setActualizando] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!window.navigator.onLine);
    const alIrOnline = () => setOffline(false);
    const alIrOffline = () => setOffline(true);
    window.addEventListener("online", alIrOnline);
    window.addEventListener("offline", alIrOffline);
    return () => {
      window.removeEventListener("online", alIrOnline);
      window.removeEventListener("offline", alIrOffline);
    };
  }, []);

  const actualizar = async () => {
    if (actualizando || offline) return;
    setActualizando(true);
    try {
      await refreshPlaces();
    } finally {
      setActualizando(false);
    }
  };

  const texto = !lastSyncedAt
    ? "Catálogo sin fecha de sincronización."
    : fromCache
      ? `Guardado · actualizado ${haceCuanto(lastSyncedAt)}`
      : `Actualizado ${haceCuanto(lastSyncedAt)}`;

  return (
    <div className="flex items-center justify-between gap-gap-sm pb-gap-sm text-meta text-ink-soft/70">
      <span className="inline-flex items-center gap-[6px]">
        {offline && <CloudOff size={13} strokeWidth={1.8} aria-hidden="true" />}
        {texto}
      </span>

      <button
        type="button"
        onClick={() => void actualizar()}
        disabled={offline || actualizando}
        title={offline ? "Necesitas conexión para actualizar" : "Actualizar catálogo"}
        className="inline-flex items-center gap-[6px] rounded-full border border-ink/10 bg-white px-3 py-1 font-semibold text-ink transition-colors duration-300 hover:border-verde-300 hover:text-verde-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw
          size={12}
          strokeWidth={1.8}
          aria-hidden="true"
          className={actualizando ? "animate-spin" : undefined}
        />
        {actualizando ? "Actualizando…" : offline ? "Sin conexión" : "Actualizar"}
      </button>
    </div>
  );
}

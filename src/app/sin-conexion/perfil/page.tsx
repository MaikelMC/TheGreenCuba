"use client";

/**
 * Perfil offline.
 *
 * El SW sirve esta página cuando se pide /profile o /notifications sin red.
 * Lee el snapshot `profile:{userId}` de IndexedDB y la actividad local de
 * localStorage. No hace ninguna petición de red.
 *
 * Sin snapshot (sesión caducada o nunca iniciada): muestra solo la actividad
 * local y la invitación a iniciar sesión, desactivada sin red.
 *
 * La franja «Sin conexión · Datos de hace X» la pinta EstadoConexion, que ya
 * vive en el layout raíz. Esta página no la duplica.
 */

import { useEffect, useState } from "react";
import { WifiOff, Heart, Clock, User } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { leerSnapshot, leerAuth, clavePerfil } from "@/lib/offline/store";
import { readActivity } from "@/lib/activity-store";
import type { PerfilSnapshotData } from "@/lib/offline/snapshots";
import type { OfflineSnapshot } from "@/lib/offline/store";

/** Sesión caducada si llevan más de 7 días sin verificarse. */
const MAX_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

interface EstadoPerfil {
  listo: boolean;
  snapshot: OfflineSnapshot<PerfilSnapshotData> | null;
  sesionValida: boolean;
  savedCount: number;
  visitCount: number;
}

export default function PerfilOfflinePage() {
  const [estado, setEstado] = useState<EstadoPerfil>({
    listo: false,
    snapshot: null,
    sesionValida: false,
    savedCount: 0,
    visitCount: 0,
  });

  useEffect(() => {
    async function cargar() {
      // 1. Leer la auth para saber qué userId usar y si la sesión es válida.
      const auth = await leerAuth();
      const sesionValida =
        !!auth && Date.now() - auth.lastAuthAt < MAX_SESSION_MS;
      const userId = auth?.userId ?? null;

      // 2. Leer el snapshot del perfil.
      const snapshot = userId
        ? await leerSnapshot<PerfilSnapshotData>(clavePerfil(userId))
        : null;

      // 3. Actividad local (guardados + visitas).
      const actividad = readActivity(userId);

      setEstado({
        listo: true,
        snapshot: sesionValida ? snapshot : null,
        sesionValida,
        savedCount: actividad.savedIds.length,
        visitCount: actividad.visits.length,
      });
    }

    void cargar();
  }, []);

  if (!estado.listo) {
    return (
      <div className="min-h-screen bg-sand" aria-busy aria-label="Cargando perfil…" />
    );
  }

  const { snapshot, sesionValida, savedCount, visitCount } = estado;
  const data = snapshot?.data;
  const savedAt = snapshot?.savedAt;

  return (
    <main className="min-h-screen bg-sand font-lv text-ink">
      {/* Cabecera */}
      <header className="safe-top sticky top-0 z-20 flex h-header items-center gap-2 border-b border-ink/5 bg-sand-warm/90 px-3 backdrop-blur-[16px]">
        <span className="font-lv-display text-base font-semibold text-ink">Mi perfil</span>
        {savedAt && (
          <span className="ml-auto font-lv-display text-meta text-ink-soft/60">
            Datos de {formatRelativeTime(new Date(savedAt).getTime())}
          </span>
        )}
      </header>

      <div className="mx-auto max-w-lg px-4 py-6 flex flex-col gap-5">
        {/* Avatar y nombre */}
        <div className="flex items-center gap-4 rounded-2xl border border-ink/5 bg-white p-4 shadow-card">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-verde-100 text-verde-600">
            <User size={26} strokeWidth={1.6} aria-hidden />
          </span>
          <div className="min-w-0">
            {data ? (
              <>
                <p className="truncate font-lv-display text-base font-bold text-ink">
                  {data.user.name}
                </p>
                <p className="truncate text-small text-ink-soft/70">{data.user.email}</p>
                {data.user.locationCity && (
                  <p className="text-meta text-ink-soft/60">{data.user.locationCity}</p>
                )}
              </>
            ) : (
              <p className="font-lv-display text-base font-semibold text-ink-soft/60">
                {sesionValida ? "Cargando perfil…" : "Sin sesión"}
              </p>
            )}
          </div>
        </div>

        {/* Guardados y actividad local */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-2xl border border-ink/5 bg-white p-4 shadow-card">
            <span className="grid size-9 place-items-center rounded-xl bg-verde-50 text-verde-600">
              <Heart size={18} strokeWidth={1.6} aria-hidden />
            </span>
            <p className="mt-2 font-lv-display text-h3 font-bold text-ink">{savedCount}</p>
            <p className="text-meta text-ink-soft/60">Guardados</p>
          </div>

          <div className="flex flex-col gap-1 rounded-2xl border border-ink/5 bg-white p-4 shadow-card">
            <span className="grid size-9 place-items-center rounded-xl bg-verde-50 text-verde-600">
              <Clock size={18} strokeWidth={1.6} aria-hidden />
            </span>
            <p className="mt-2 font-lv-display text-h3 font-bold text-ink">{visitCount}</p>
            <p className="text-meta text-ink-soft/60">Visitados</p>
          </div>
        </div>

        {/* Aviso de sesión caducada o sin sesión */}
        {!sesionValida && (
          <div className="rounded-2xl border border-ink/5 bg-white p-5 text-center shadow-card">
            <WifiOff
              size={28}
              strokeWidth={1.6}
              className="mx-auto mb-3 text-ink-soft/40"
              aria-hidden
            />
            <p className="font-lv-display text-base font-semibold text-ink">
              Sesión no disponible
            </p>
            <p className="mt-1 text-small leading-relaxed text-ink-soft/70 text-pretty">
              {savedAt
                ? "Tu sesión ha caducado. Los datos guardados se bloquean por seguridad."
                : "No hay datos de perfil guardados en este dispositivo."}
            </p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-describedby="login-sin-red"
              className={cn(
                "mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-6",
                "font-lv-display text-small font-semibold",
                "bg-ink/10 text-ink-soft/40 cursor-not-allowed",
              )}
            >
              Iniciar sesión
            </button>
            <p
              id="login-sin-red"
              className="mt-2 text-meta text-ink-soft/50"
            >
              Necesita conexión
            </p>
          </div>
        )}

        {/* Aviso general de modo offline */}
        <p className="text-center text-meta text-ink-soft/50 pb-safe-bottom">
          Estás viendo los datos guardados en este dispositivo.
          Conecta a internet para ver la información más reciente.
        </p>
      </div>
    </main>
  );
}

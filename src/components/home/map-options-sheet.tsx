"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronRight,
  Flame,
  Layers,
  RefreshCw,
  X,
} from "lucide-react";
import { InstallMapButton } from "@/components/map/install-map-button";

function Fila({
  icono,
  titulo,
  apoyo,
  activo,
  onClick,
  deshabilitado,
}: {
  icono: ReactNode;
  titulo: string;
  apoyo: string;
  activo?: boolean;
  onClick: () => void;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-pressed={activo}
      className="flex min-h-12 w-full items-center gap-gap-sm rounded-2xl px-1 py-2 text-left transition-colors duration-300 hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400 disabled:cursor-wait disabled:opacity-60"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-verde-50 text-verde-700 dark:bg-verde-950">
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-lv-display text-small font-semibold text-ink">
          {titulo}
        </span>
        <span className="mt-[1px] block text-meta leading-snug text-ink-soft/75">
          {apoyo}
        </span>
      </span>
      {activo !== undefined ? (
        <span
          aria-hidden
          className={
            activo
              ? "relative h-7 w-12 shrink-0 rounded-full bg-verde-400"
              : "relative h-7 w-12 shrink-0 rounded-full bg-ink/15"
          }
        >
          <span
            className={
              activo
                ? "panel-switch-thumb absolute left-[23px] top-[3px] size-[22px] rounded-full bg-white shadow-sm"
                : "panel-switch-thumb absolute left-[3px] top-[3px] size-[22px] rounded-full bg-white shadow-sm"
            }
          />
        </span>
      ) : (
        <ChevronRight
          size={17}
          strokeWidth={1.8}
          aria-hidden
          className="shrink-0 text-ink-soft/50"
        />
      )}
    </button>
  );
}

/**
 * «Opciones del mapa»: los tres controles que antes vivían sueltos.
 *
 * El modo nocturno no está aquí porque la luna cambia el tema de toda la app,
 * no solo el mapa; ese ajuste sigue en el perfil. «Solo lo abierto» comparte
 * estado con el filtro de la hoja. «Actualizar datos» conserva el refresco
 * manual que tenía la hoja.
 */
export function MapOptionsSheet({
  open,
  onClose,
  soloAbierto,
  onToggleSoloAbierto,
  vista3d,
  onToggleVista3d,
  onNovedades,
  onRefrescar,
  refrescando,
}: {
  open: boolean;
  onClose: () => void;
  soloAbierto: boolean;
  onToggleSoloAbierto: () => void;
  vista3d: boolean;
  onToggleVista3d: () => void;
  onNovedades: () => void;
  onRefrescar: () => void;
  refrescando: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") onClose();
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[400]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            type="button"
            aria-label="Cerrar opciones del mapa"
            onClick={onClose}
            className="absolute inset-0 bg-ink/40"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-options-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 flex max-h-[86vh] flex-col rounded-t-4xl bg-white shadow-card supports-[height:100dvh]:max-h-[86dvh]"
          >
            <div className="mx-auto flex h-7 w-16 shrink-0 items-center justify-center">
              <span className="h-1 w-10 rounded-full bg-ink/15" />
            </div>

            <div className="flex items-start justify-between gap-gap-sm px-gap-md pb-gap-sm">
              <div className="min-w-0">
                <h2
                  id="map-options-title"
                  className="font-lv-display text-h3 font-semibold text-ink"
                >
                  Opciones del mapa
                </h2>
                <p className="mt-[2px] text-meta text-ink-soft/75">
                  Lo que se ve y cómo se ve
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-gap-xs">
                <InstallMapButton />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar opciones del mapa"
                  className="grid size-11 place-items-center rounded-full bg-sand text-ink-soft transition-colors duration-300 hover:bg-sand-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
                >
                  <X size={17} strokeWidth={1.8} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-ink/5 px-gap-md pb-safe-bottom">
              <div className="flex flex-col py-gap-xs">
                <Fila
                  icono={<Layers size={18} strokeWidth={1.8} />}
                  titulo="Solo lo abierto"
                  apoyo="Oculta en el mapa y la lista lo que está cerrado."
                  activo={soloAbierto}
                  onClick={onToggleSoloAbierto}
                />
                <Fila
                  icono={<span className="font-lv-display text-[12px] font-bold">3D</span>}
                  titulo="Vista 3D"
                  apoyo="Edificios en relieve · gasta más batería y datos."
                  activo={vista3d}
                  onClick={onToggleVista3d}
                />
                <Fila
                  icono={<Flame size={18} strokeWidth={1.8} />}
                  titulo="Novedades cerca de ti"
                  apoyo="Ofertas, productos nuevos y cambios de tu zona."
                  onClick={onNovedades}
                />
                <Fila
                  icono={<RefreshCw size={18} strokeWidth={1.8} />}
                  titulo={refrescando ? "Actualizando…" : "Actualizar datos"}
                  apoyo="Vuelve a pedir el catálogo ahora."
                  onClick={onRefrescar}
                  deshabilitado={refrescando}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

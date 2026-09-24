"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { CheckCircle2, Clock3, MapPin, Search, XCircle } from "lucide-react";
import { usePlaces } from "@/providers/places-provider";
import { PLAN_LABEL } from "@/lib/places-store";
import { cn } from "@/lib/utils";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";
import { RequestDetailSheet } from "@/components/admin/request-detail-sheet";

const FILTER =
  "h-[42px] px-3 rounded-xl border border-ink/10 bg-white font-lv-display text-small text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20 cursor-pointer";

export function RequestsList() {
  const { places, hydrated, updatePlace, removePlace } = usePlaces();
  const [query, setQuery] = useState("");
  /* La solicitud abierta en el sheet de detalle. `null` = cerrado. El sheet
     conserva el contenido por su cuenta durante la animación de cierre. */
  const [detailPlace, setDetailPlace] = useState<null | (typeof places)[number]>(null);

  const requests = useMemo(
    () =>
      places.filter((place) => !place.isActive).filter((place) => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return `${place.name} ${place.category} ${place.barrio} ${place.address}`
          .toLowerCase()
          .includes(q);
      }),
    [places, query],
  );

  const approveRequest = useCallback(
    async (id: string, name: string) => {
      const updated = await updatePlace(id, { isActive: true });
      if (!updated) {
        toast.error(`No se pudo aprobar "${name}".`);
        return;
      }
      toast.success(`"${name}" ya está publicado en La Verde.`);
      /* Aprobada o rechazada, la solicitud deja de existir: si el sheet la
         enseñaba, se cierra. */
      setDetailPlace(null);
    },
    [updatePlace],
  );

  const rejectRequest = useCallback(
    async (id: string, name: string) => {
      const confirmed = window.confirm(`¿Rechazar la solicitud de "${name}"?`);
      if (!confirmed) return;

      const deleted = await removePlace(id);
      if (!deleted) {
        toast.error(`No se pudo rechazar "${name}".`);
        return;
      }
      toast.success(`La solicitud de "${name}" fue rechazada.`);
      setDetailPlace(null);
    },
    [removePlace],
  );

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-md">
        <h1 className="sr-only">Solicitudes</h1>
        <p className="text-small text-ink-soft/75">
          {requests.length} negocio{requests.length === 1 ? "" : "s"} pendiente
          {requests.length === 1 ? "" : "s"} de aprobación
        </p>
      </div>

      <div className="mb-gap-md">
        <div className="relative flex-1">
          <Search
            size={16}
            strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/75 pointer-events-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar solicitud por nombre, barrio o categoría..."
            aria-label="Buscar solicitudes"
            className={cn(FILTER, "w-full pl-9 text-body")}
          />
        </div>
      </div>

      {!hydrated ? (
        <LoadingState label="Cargando solicitudes…" />
      ) : requests.length === 0 ? (
        <StateView
          size="sm"
          icon={Clock3}
          title="No hay solicitudes pendientes"
          description="Cuando un usuario agregue un negocio, aparecerá aquí para aprobarlo."
          className="rounded-2xl border border-ink/5 bg-white shadow-soft"
        />
      ) : (
        <div className="flex flex-col gap-gap-sm">
          {requests.map((place, index) => (
            <motion.div
              key={place.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.35 }}
              className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft"
            >
              {/* La tarjeta abre el detalle. No puede ser un <button>: aquí
                  dentro viven los botones de Rechazar/Aprobar y HTML no
                  permite botones anidados (error de hidratación). El papel de
                  botón se lo da role="button", el gesto explícito es el
                  enlace "Ver detalles" de abajo, y los botones de acción
                  quedan como hermanos con stopPropagation. */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDetailPlace(place)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetailPlace(place);
                  }
                }}
                aria-haspopup="dialog"
                className="group flex w-full cursor-pointer flex-col gap-gap-sm rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
              >
                <div className="flex flex-col gap-gap-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-gap-xs flex-wrap">
                      <span className="font-lv-display text-small font-semibold text-ink group-hover:text-verde-600 transition-colors duration-500 ease-outquint">
                        {place.name}
                      </span>
                      <span className="inline-flex items-center gap-[4px] rounded-full bg-sand px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft/75">
                        Pendiente
                      </span>
                      {/* El plan que eligió el dueño al enviar la solicitud. Va
                          en la tarjeta y no solo en el detalle porque es con lo
                          que se decide: las condiciones de la prueba caducan.
                          Sin `plan` —fichas viejas, anteriores a la columna— no
                          se pinta nada, que es la verdad: nadie eligió. */}
                      {place.plan && (
                        <span className="inline-flex items-center gap-[4px] rounded-full border border-verde-200 bg-verde-50 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-700">
                          {PLAN_LABEL[place.plan]}
                        </span>
                      )}
                    </div>
                    <div className="mt-[2px] flex flex-wrap items-center gap-gap-xs text-meta text-ink-soft/75">
                      <span>{place.category}</span>
                      <span>·</span>
                      <span>{place.barrio || place.address || "Sin barrio"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-gap-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        rejectRequest(place.id, place.name);
                      }}
                      className="inline-flex items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md py-[10px] font-lv-display text-small font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:border-destructive hover:text-destructive"
                    >
                      <XCircle size={16} strokeWidth={1.8} />
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        approveRequest(place.id, place.name);
                      }}
                      className="inline-flex items-center justify-center gap-gap-xs rounded-full bg-verde-500 px-gap-md py-[10px] font-lv-display text-small font-semibold text-white shadow-[0_16px_30px_-12px_rgba(53,175,109,0.75)] transition-colors duration-500 ease-outquint hover:bg-verde-600"
                    >
                      <CheckCircle2 size={16} strokeWidth={1.8} />
                      Aprobar
                    </button>
                  </div>
                </div>

                <div className="mt-gap-sm grid gap-gap-sm text-meta text-ink-soft/75 sm:grid-cols-2">
                  <div className="flex items-center gap-gap-xs">
                    <MapPin size={14} strokeWidth={1.8} className="text-verde-600" />
                    <span>{place.address || "Dirección no indicada"}</span>
                  </div>
                  <div className="flex items-center gap-gap-xs">
                    <Clock3 size={14} strokeWidth={1.8} className="text-verde-600" />
                    <span>
                      Enviado el {new Date(place.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Enlace de texto explícito, hermano de la tarjeta: el gesto
                  que no depende de adivinar que la tarjeta es clicable. */}
              <button
                type="button"
                onClick={() => setDetailPlace(place)}
                className="mt-gap-xs inline-flex w-fit items-center gap-[4px] rounded-full font-lv-display text-meta font-semibold text-verde-600 transition-colors duration-500 ease-outquint hover:text-verde-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
              >
                Ver detalles completos
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detalle completo del negocio solicitante. */}
      <RequestDetailSheet
        place={detailPlace}
        onClose={() => setDetailPlace(null)}
        onApprove={(id, name) => void approveRequest(id, name)}
        onReject={(id, name) => void rejectRequest(id, name)}
      />
    </>
  );
}

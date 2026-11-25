"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { usePlaces } from "@/providers/places-provider";
import { alreadySaid } from "@/lib/places";
import { PLAN_LABEL, type UserPlace, type PlacePlan } from "@/lib/places-store";
import { placeInUserProvince } from "@/lib/user-province";
import { CUBA_PROVINCES } from "@/lib/user-preferences-store";
import { cn } from "@/lib/utils";
import type { RevisionSolicitudAdmin } from "@/lib/admin-solicitudes";
import type { RevisionSolicitud } from "@/lib/revision-solicitud";
import {
  TIPOS_NEGOCIO,
  TIPO_NEGOCIO_LABEL,
  type TipoNegocio,
} from "@/lib/ficha/tipos";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";
import { ChapitaEstado } from "./ui/chapita";
import { EnlaceNegocio } from "./enlace-negocio";
import { RequestDetailSheet } from "@/components/admin/request-detail-sheet";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const FILTER =
  "h-[42px] px-3 rounded-xl border border-ink/10 bg-white font-lv-display text-small text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20 cursor-pointer";

function RevisionChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <ChapitaEstado tono={ok ? "ok" : "aviso"} punto={false}>
      {label}
    </ChapitaEstado>
  );
}

function RevisionChips({
  datos,
  cargando,
}: {
  datos?: RevisionSolicitudAdmin;
  cargando: boolean;
}) {
  if (!datos) {
    return (
      <p className="inline-flex items-center gap-gap-xs text-meta text-ink-soft/60">
        {cargando ? (
          <>
            <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />
            Calculando revisión…
          </>
        ) : (
          "Revisión automática no disponible"
        )}
      </p>
    );
  }

  const revision = datos.revision;
  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      <RevisionChip
        ok={revision.fotos}
        label={revision.fotos ? "Fotos" : "Sin fotos"}
      />
      <RevisionChip
        ok={revision.horario}
        label={revision.horario ? "Horario" : "Sin horario"}
      />
      <RevisionChip
        ok={revision.ubicacion}
        label={revision.ubicacion ? "Ubicación" : "Ubicación inválida"}
      />
      <RevisionChip
        ok={revision.tipo}
        label={revision.tipo ? "Tipo asignado" : "Sin tipo"}
      />
      {revision.telefonoDuplicado ? (
        <ChapitaEstado tono="error" punto={false}>
          Teléfono repetido
        </ChapitaEstado>
      ) : (
        <RevisionChip ok label="Teléfono único" />
      )}
      {revision.mismoDueno && (
        <span title={datos.mismoDuenoCon.join(" · ")}>
          <ChapitaEstado tono="info" punto={false}>
            Mismo dueño
          </ChapitaEstado>
        </span>
      )}
    </div>
  );
}

function RevisionDetalle({ datos }: { datos?: RevisionSolicitudAdmin }) {
  if (!datos) return null;
  return (
    <>
      {datos.telefonoDuplicadoCon.length > 0 && (
        <p className="text-meta text-destructive-ink">
          Teléfono repetido con: {datos.telefonoDuplicadoCon.join(", ")}.
        </p>
      )}
      {datos.mismoDuenoCon.length > 0 && (
        <p className="text-meta text-ink-soft/75">
          El mismo dueño tiene: {datos.mismoDuenoCon.join(", ")}.
        </p>
      )}
    </>
  );
}

function planElegido(plan: PlacePlan | null | undefined): string | null {
  if (!plan) return null;
  return PLAN_LABEL[plan] ?? null;
}

export function RequestsList() {
  const { places, hydrated, updatePlace, removePlace } = usePlaces();
  const [query, setQuery] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  const [revisiones, setRevisiones] = useState<
    Record<string, RevisionSolicitudAdmin>
  >({});
  const [cargandoRevisiones, setCargandoRevisiones] = useState(true);
  const [errorRevisiones, setErrorRevisiones] = useState(false);

  const [asignandoTipoId, setAsignandoTipoId] = useState<string | null>(null);
  const [aprobandoId, setAprobandoId] = useState<string | null>(null);
  const [pidiendoCambiosId, setPidiendoCambiosId] = useState<string | null>(
    null,
  );

  const [rejection, setRejection] = useState<null | {
    id: string;
    name: string;
  }>(null);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const cargarRevisiones = useCallback(async () => {
    setCargandoRevisiones(true);
    setErrorRevisiones(false);
    try {
      const res = await fetch("/api/admin/solicitudes/revisiones", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        revisiones?: RevisionSolicitudAdmin[];
      };
      setRevisiones(
        Object.fromEntries(
          (data.revisiones ?? []).map((fila) => [fila.id, fila]),
        ) as Record<string, RevisionSolicitudAdmin>,
      );
    } catch {
      setErrorRevisiones(true);
    } finally {
      setCargandoRevisiones(false);
    }
  }, []);

  useEffect(() => {
    void cargarRevisiones();
  }, [cargarRevisiones]);

  const requests = useMemo(
    () =>
      places
        .filter((place) => place.reviewStatus === "pending")
        .filter((place) => {
          if (
            provinceFilter !== "all" &&
            !placeInUserProvince(place, provinceFilter)
          )
            return false;
          if (!query.trim()) return true;
          const q = query.trim().toLowerCase();
          return `${place.name} ${place.category} ${place.barrio} ${place.address}`
            .toLowerCase()
            .includes(q);
        }),
    [places, query, provinceFilter],
  );

  const detailPlace =
    (detailId && places.find((place) => place.id === detailId)) || null;
  const revisionDetalle = detailId ? revisiones[detailId] : undefined;

  const assignType = useCallback(
    async (id: string, tipo: TipoNegocio) => {
      if (asignandoTipoId) return;
      setAsignandoTipoId(id);
      const updated = await updatePlace(id, { tipoNegocio: tipo });
      setAsignandoTipoId(null);
      if (!updated) {
        toast.error("No se pudo asignar el tipo de negocio.");
        return;
      }
      toast.success(`Tipo asignado: ${TIPO_NEGOCIO_LABEL[tipo]}.`);
      void cargarRevisiones();
    },
    [asignandoTipoId, cargarRevisiones, updatePlace],
  );

  const approveRequest = useCallback(
    async (id: string, name: string) => {
      const place = places.find((fila) => fila.id === id);
      if (!place) return;
      if (!place.tipoNegocio) {
        toast.error("Asigna el tipo de negocio antes de aprobar.");
        return;
      }
      if (aprobandoId) return;

      setAprobandoId(id);
      const updated = await updatePlace(id, {
        isActive: true,
        reviewStatus: "approved",
      });
      setAprobandoId(null);
      if (!updated) {
        toast.error(`No se pudo aprobar «${name}».`);
        return;
      }
      toast.success(`«${name}» ya está publicado en La Verde.`);
      setDetailId(null);
      void cargarRevisiones();
    },
    [aprobandoId, cargarRevisiones, places, updatePlace],
  );

  const openRejection = useCallback((id: string, name: string) => {
    setRejection({ id, name });
    setRejectionMessage("");
  }, []);

  const rejectRequest = useCallback(async () => {
    if (!rejection) return;
    setRejecting(true);
    const deleted = await removePlace(rejection.id, rejectionMessage.trim());
    setRejecting(false);
    if (!deleted) {
      toast.error(`No se pudo rechazar «${rejection.name}».`);
      return;
    }
    toast.success(
      `La solicitud de «${rejection.name}» fue rechazada y notificada.`,
    );
    setRejection(null);
    setDetailId(null);
    void cargarRevisiones();
  }, [cargarRevisiones, removePlace, rejection, rejectionMessage]);

  const requestChanges = useCallback(
    async (id: string, name: string) => {
      const revision = revisiones[id]?.revision;
      const faltan = revision?.faltan ?? [];
      if (faltan.length === 0) {
        toast.error("La revisión automática no encontró datos que falten.");
        return;
      }
      if (pidiendoCambiosId) return;

      const confirmado = window.confirm(
        `Se enviará al solicitante un aviso con lo que falta de «${name}»:\n\n${faltan.join("\n")}\n\n¿Enviar el mensaje?`,
      );
      if (!confirmado) return;

      setPidiendoCambiosId(id);
      try {
        const respuesta = await fetch(
          `/api/admin/solicitudes/${encodeURIComponent(id)}/cambios`,
          { method: "POST" },
        );
        const datos = (await respuesta.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!respuesta.ok) {
          throw new Error(datos?.error ?? "No se pudo pedir cambios.");
        }
        toast.success("Mensaje enviado al solicitante.");
      } catch (fallo) {
        toast.error(
          fallo instanceof Error ? fallo.message : "No se pudo pedir cambios.",
        );
      } finally {
        setPidiendoCambiosId(null);
      }
    },
    [pidiendoCambiosId, revisiones],
  );

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm">
        <h1 className="sr-only">Solicitudes</h1>
        <p className="inline-flex items-center gap-gap-xs text-small text-ink-soft/75">
          {requests.length} negocio{requests.length === 1 ? "" : "s"} pendiente
          {requests.length === 1 ? "" : "s"} de aprobación
          {cargandoRevisiones && (
            <Loader2
              size={13}
              strokeWidth={1.8}
              className="animate-spin text-verde-600"
              aria-label="Calculando revisión"
            />
          )}
        </p>
      </div>

      <div className="mb-gap-md mt-gap-sm flex flex-col gap-gap-sm sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/75"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar solicitud por nombre, barrio o categoría…"
            aria-label="Buscar solicitudes"
            className={cn(FILTER, "w-full pl-9 text-body")}
          />
        </div>
        <select
          value={provinceFilter}
          onChange={(event) => setProvinceFilter(event.target.value)}
          className={FILTER}
          aria-label="Filtrar por provincia"
        >
          <option value="all">Todas las provincias</option>
          {CUBA_PROVINCES.filter((province) =>
            places.some((place) => placeInUserProvince(place, province.label)),
          ).map((province) => (
            <option key={province.value} value={province.label}>
              {province.label}
            </option>
          ))}
        </select>
      </div>

      {errorRevisiones && (
        <div className="mb-gap-md flex items-start gap-gap-sm rounded-xl border border-destructive/20 bg-destructive/5 px-gap-sm py-gap-sm text-small text-destructive-ink">
          <AlertTriangle
            size={16}
            strokeWidth={1.8}
            className="mt-[1px] shrink-0"
          />
          <p className="flex-1">
            No se pudo calcular la revisión automática. Las solicitudes siguen
            aquí, pero no se puede comprobar si les falta algo.
          </p>
          <button
            type="button"
            onClick={() => void cargarRevisiones()}
            className="shrink-0 font-lv-display text-meta font-semibold underline underline-offset-2"
          >
            Reintentar
          </button>
        </div>
      )}

      {!hydrated ? (
        <LoadingState label="Cargando solicitudes…" />
      ) : requests.length === 0 ? (
        <StateView
          size="sm"
          icon={Clock3}
          title="No hay solicitudes pendientes"
          description="Cuando un usuario agregue un negocio, aparecerá aquí para revisarlo y publicarlo."
          className="rounded-2xl border border-ink/5 bg-white"
        />
      ) : (
        <div className="flex flex-col gap-gap-sm">
          {requests.map((place, index) => {
            const datosRevision = revisiones[place.id];
            const faltan = datosRevision?.revision.faltan ?? [];
            const puedeAprobar = Boolean(place.tipoNegocio);
            const plan = planElegido(place.plan);

            return (
              <motion.article
                key={place.id}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.35 }}
                className="rounded-2xl border border-ink/5 bg-white p-gap-md"
              >
                <div className="flex flex-col gap-gap-sm sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-gap-xs">
                      <EnlaceNegocio
                        id={place.id}
                        title={`Abrir la ficha de ${place.name}`}
                        className="min-w-0 max-w-full truncate font-lv-display text-small font-semibold text-ink transition-colors hover:text-verde-700"
                      >
                        {place.name}
                      </EnlaceNegocio>
                      <ChapitaEstado tono="aviso" punto={false}>
                        Pendiente
                      </ChapitaEstado>
                      {plan && (
                        <ChapitaEstado tono="ok" punto={false}>
                          {plan}
                        </ChapitaEstado>
                      )}
                    </div>
                    <p className="mt-[2px] flex flex-wrap items-center gap-gap-xs text-meta text-ink-soft/75">
                      <span>{place.category}</span>
                      {!alreadySaid(place.address, place.barrio) && (
                        <>
                          <span>·</span>
                          <span>{place.barrio}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        Enviado el{" "}
                        {new Date(place.createdAt).toLocaleDateString("es-CU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                    <p className="mt-gap-xs flex items-start gap-gap-xs text-meta text-ink-soft/75">
                      <MapPin
                        size={14}
                        strokeWidth={1.8}
                        className="mt-[1px] shrink-0 text-verde-600"
                      />
                      {place.address || "Dirección no indicada"}
                    </p>
                  </div>
                </div>

                <div className="mt-gap-sm flex flex-col gap-gap-xs">
                  <RevisionChips
                    datos={datosRevision}
                    cargando={cargandoRevisiones}
                  />
                  <RevisionDetalle datos={datosRevision} />

                  <div className="flex flex-wrap items-center gap-gap-xs">
                    <label
                      htmlFor={`tipo-${place.id}`}
                      className="font-lv-display text-meta font-semibold text-ink-soft/75"
                    >
                      Tipo de negocio
                    </label>
                    <select
                      id={`tipo-${place.id}`}
                      value={place.tipoNegocio ?? ""}
                      onChange={(event) => {
                        if (event.target.value) {
                          void assignType(
                            place.id,
                            event.target.value as TipoNegocio,
                          );
                        }
                      }}
                      disabled={asignandoTipoId === place.id}
                      className={cn(
                        "h-9 min-w-[220px] rounded-xl border bg-white px-3 font-lv-display text-small text-ink outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20 disabled:opacity-60",
                        place.tipoNegocio
                          ? "border-ink/10"
                          : "border-lv-amber/60",
                      )}
                    >
                      <option value="" disabled>
                        Asignar tipo…
                      </option>
                      {TIPOS_NEGOCIO.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {TIPO_NEGOCIO_LABEL[tipo]}
                        </option>
                      ))}
                    </select>
                    {!puedeAprobar && (
                      <span className="text-meta text-destructive-ink">
                        Asigna el tipo para poder aprobar.
                      </span>
                    )}
                  </div>

                  <div className="mt-gap-xs flex flex-wrap items-center gap-gap-xs">
                    <button
                      type="button"
                      onClick={() => setDetailId(place.id)}
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink transition-colors hover:border-verde-300 hover:text-verde-700"
                    >
                      Ver detalles completos
                    </button>
                    <button
                      type="button"
                      onClick={() => openRejection(place.id, place.name)}
                      className="inline-flex min-h-10 items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink-soft/75 transition-colors hover:border-destructive hover:text-destructive"
                    >
                      <XCircle size={15} strokeWidth={1.8} />
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => void requestChanges(place.id, place.name)}
                      disabled={
                        pidiendoCambiosId !== null ||
                        faltan.length === 0 ||
                        !datosRevision
                      }
                      title={
                        faltan.length === 0
                          ? "La revisión no encontró datos que falten."
                          : undefined
                      }
                      className="inline-flex min-h-10 items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink transition-colors hover:border-verde-300 hover:text-verde-700 disabled:pointer-events-none disabled:opacity-45"
                    >
                      <Send size={15} strokeWidth={1.8} />
                      {pidiendoCambiosId === place.id
                        ? "Enviando…"
                        : "Pedir cambios"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void approveRequest(place.id, place.name)}
                      disabled={!puedeAprobar || aprobandoId !== null}
                      title={
                        puedeAprobar
                          ? "Aprobar y publicar"
                          : "Asigna un tipo de negocio antes de aprobar"
                      }
                      className="inline-flex min-h-10 items-center justify-center gap-gap-xs rounded-full bg-verde-500 px-gap-md font-lv-display text-small font-semibold text-white shadow-[0_16px_30px_-12px_rgba(53,175,109,0.75)] transition-colors hover:bg-verde-600 disabled:pointer-events-none disabled:opacity-45"
                    >
                      <CheckCircle2 size={15} strokeWidth={1.8} />
                      {aprobandoId === place.id
                        ? "Aprobando…"
                        : "Aprobar y publicar"}
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <RequestDetailSheet
        place={detailPlace}
        revision={revisionDetalle?.revision ?? null}
        telefonoDuplicadoCon={revisionDetalle?.telefonoDuplicadoCon}
        mismoDuenoCon={revisionDetalle?.mismoDuenoCon}
        puedeAprobar={Boolean(detailPlace?.tipoNegocio)}
        asignandoTipo={asignandoTipoId === detailPlace?.id}
        pidiendoCambios={pidiendoCambiosId === detailPlace?.id}
        onAssignType={(id, tipo) => void assignType(id, tipo)}
        onRequestChanges={(id, name) => void requestChanges(id, name)}
        onClose={() => setDetailId(null)}
        onApprove={(id, name) => void approveRequest(id, name)}
        onReject={(id, name) => openRejection(id, name)}
      />

      <Dialog
        open={rejection !== null}
        onOpenChange={(open) => {
          if (!open && !rejecting) setRejection(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
            <DialogDescription>
              {rejection
                ? `La solicitud de «${rejection.name}» recibirá un aviso. Puedes añadir el motivo para que sepa qué corregir.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <textarea
            value={rejectionMessage}
            onChange={(event) => setRejectionMessage(event.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Motivo del rechazo (opcional)"
            aria-label="Motivo del rechazo"
            className="min-h-[112px] w-full resize-y rounded-xl border border-ink/10 bg-white px-3 py-3 text-small text-ink outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
            disabled={rejecting}
          />

          <DialogFooter className="gap-gap-xs sm:gap-gap-xs">
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-full border border-ink/10 px-gap-md py-[10px] text-small font-semibold text-ink-soft/75"
              >
                Cancelar
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={() => void rejectRequest()}
              disabled={rejecting}
              className="inline-flex items-center justify-center gap-gap-xs rounded-full bg-destructive px-gap-md py-[10px] text-small font-semibold text-white disabled:opacity-60"
            >
              {rejecting ? "Enviando…" : "Rechazar y notificar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

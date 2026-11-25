"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Target,
  UserRound,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ETAPAS_PROSPECTO,
  ETAPA_LABEL,
  ORIGENES_PROSPECTO,
  ORIGEN_LABEL,
  etapaAnterior,
  textoOrigen,
  type AdminProspecto,
  type EtapaProspecto,
  type OrigenProspecto,
  type ProspectoAdmin,
} from "@/lib/prospectos";
import { usePlaces } from "@/providers/places-provider";

/**
 * El tablero de prospectos.
 *
 * En escritorio son cinco columnas y en móvil cinco pestañas: la misma etapa no
 * puede depender de que la pantalla quepa. Mover y retroceder usan la misma API,
 * y el formulario solo pide lo que el seguimiento necesita para no quedarse en
 * una lista de nombres.
 */

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-small text-ink placeholder:text-ink-soft/75 outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

const AREA =
  "w-full rounded-xl border border-ink/10 bg-white px-3 py-3 text-small text-ink placeholder:text-ink-soft/75 outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";

interface Draft {
  nombre: string;
  provincia: string;
  origen: OrigenProspecto;
  origenDetalle: string;
  etapa: EtapaProspecto;
  proximoPaso: string;
  proximoPasoEn: string;
  notas: string;
  adminResponsableId: string;
  negocioId: string;
}

function borrador(
  prospecto: ProspectoAdmin | null,
  adminId: string,
): Draft {
  return {
    nombre: prospecto?.nombre ?? "",
    provincia: prospecto?.provincia ?? "",
    origen: prospecto?.origen ?? "visita_propia",
    origenDetalle: prospecto?.origenDetalle ?? "",
    etapa: prospecto?.etapa ?? "contactado",
    proximoPaso: prospecto?.proximoPaso ?? "",
    proximoPasoEn: prospecto?.proximoPasoEn?.slice(0, 10) ?? "",
    notas: prospecto?.notas ?? "",
    adminResponsableId:
      prospecto?.adminResponsableId ?? adminId,
    negocioId: prospecto?.negocioId ?? "",
  };
}

function fechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-CU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Havana",
  }).format(new Date(iso));
}

export function ProspectosBoard({
  prospectosIniciales,
  admins,
}: {
  prospectosIniciales: ProspectoAdmin[];
  admins: AdminProspecto[];
}) {
  const [prospectos, setProspectos] = useState(prospectosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [etapaMovil, setEtapaMovil] = useState<EtapaProspecto>("contactado");
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<ProspectoAdmin | null>(null);
  const [draft, setDraft] = useState<Draft>(() => borrador(null, admins[0]?.id ?? ""));
  const [guardando, setGuardando] = useState(false);
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { places } = usePlaces();

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return prospectos;
    return prospectos.filter((prospecto) =>
      [
        prospecto.nombre,
        prospecto.provincia,
        prospecto.proximoPaso,
        prospecto.notas,
        prospecto.adminResponsableNombre,
        prospecto.negocioNombre,
        textoOrigen(prospecto.origen, prospecto.origenDetalle),
      ]
        .filter(Boolean)
        .some((valor) => valor!.toLowerCase().includes(q)),
    );
  }, [busqueda, prospectos]);

  const porEtapa = useMemo(() => {
    const mapa: Record<EtapaProspecto, ProspectoAdmin[]> = {
      contactado: [],
      visitado: [],
      interesado: [],
      pack_enviado: [],
      pagando: [],
    };
    for (const prospecto of visibles) mapa[prospecto.etapa].push(prospecto);
    return mapa;
  }, [visibles]);

  function abrirNuevo() {
    setEditando(null);
    setDraft(borrador(null, admins[0]?.id ?? ""));
    setError(null);
    setAbierto(true);
  }

  function abrirEditar(prospecto: ProspectoAdmin) {
    setEditando(prospecto);
    setDraft(borrador(prospecto, admins[0]?.id ?? ""));
    setError(null);
    setAbierto(true);
  }

  function setCampo<K extends keyof Draft>(campo: K, valor: Draft[K]) {
    setDraft((actual) => ({ ...actual, [campo]: valor }));
  }

  async function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(
        editando
          ? `/api/admin/prospectos/${editando.id}`
          : "/api/admin/prospectos",
        {
          method: editando ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            origenDetalle: draft.origenDetalle.trim() || null,
            proximoPasoEn: draft.proximoPasoEn || null,
            adminResponsableId: draft.adminResponsableId || null,
            negocioId: draft.negocioId || null,
          }),
        },
      );
      const data = (await res.json().catch(() => null)) as
        | (ProspectoAdmin & { error?: string })
        | null;
      if (!res.ok || !data) {
        throw new Error(data?.error ?? "No se pudo guardar el prospecto.");
      }
      setProspectos((actual) =>
        editando
          ? actual.map((item) => (item.id === data.id ? data : item))
          : [data, ...actual],
      );
      setAbierto(false);
      toast.success(
        editando
          ? `Se guardó «${data.nombre}».`
          : `«${data.nombre}» entró en ${ETAPA_LABEL[data.etapa]}.`,
      );
    } catch (fallo) {
      const mensaje =
        fallo instanceof Error ? fallo.message : "No se pudo guardar el prospecto.";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  async function mover(prospecto: ProspectoAdmin, etapa: EtapaProspecto) {
    if (etapa === prospecto.etapa || moviendo) return;
    setMoviendo(prospecto.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/prospectos/${prospecto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapa }),
      });
      const data = (await res.json().catch(() => null)) as
        | (ProspectoAdmin & { error?: string })
        | null;
      if (!res.ok || !data) {
        throw new Error(data?.error ?? "No se pudo mover el prospecto.");
      }
      setProspectos((actual) =>
        actual.map((item) => (item.id === data.id ? data : item)),
      );
      toast.success(`«${data.nombre}» pasó a ${ETAPA_LABEL[data.etapa]}.`);
      if (etapa === "pagando" && !data.negocioId) {
        toast.info("Para enlazar la ficha, abre Editar y elige el negocio.");
      }
    } catch (fallo) {
      const mensaje =
        fallo instanceof Error ? fallo.message : "No se pudo mover el prospecto.";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setMoviendo(null);
    }
  }

  const total = prospectos.length;
  const pagando = porEtapa.pagando.length;

  return (
    <div className="flex flex-col gap-gap-md">
      <header className="flex flex-wrap items-end justify-between gap-gap-sm">
        <div>
          <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.14em] text-verde-600">
            Crecimiento
          </p>
          <h1 className="font-lv-display text-h2 font-bold text-ink">Prospectos</h1>
          <p className="mt-1 max-w-xl text-small text-ink-soft/75">
            El seguimiento antes de que exista una ficha: quién lo lleva, qué toca
            ahora y en qué etapa está.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirNuevo}
          className="inline-flex h-11 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition hover:bg-verde-300 active:scale-[0.98]"
        >
          <Plus size={17} strokeWidth={1.8} />
          Nuevo prospecto
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-gap-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
          />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre, provincia, responsable o nota…"
            aria-label="Buscar prospectos"
            className={`${INPUT} pl-9`}
          />
        </div>
        <p className="text-meta text-ink-soft/70">
          {total} {total === 1 ? "prospecto" : "prospectos"} · {pagando} pagando
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/5 px-gap-sm py-gap-xs text-meta text-destructive"
        >
          {error}
        </p>
      )}

      {/* Escritorio: cinco columnas. */}
      <div className="hidden gap-gap-sm lg:grid lg:grid-cols-5">
        {ETAPAS_PROSPECTO.map((etapa) => (
          <section
            key={etapa}
            className="flex min-h-[320px] flex-col gap-gap-sm rounded-2xl border border-ink/5 bg-sand/35 p-gap-sm"
            aria-labelledby={`etapa-${etapa}`}
          >
            <div className="flex items-center justify-between gap-gap-xs">
              <h2
                id={`etapa-${etapa}`}
                className="font-lv-display text-small font-bold text-ink"
              >
                {ETAPA_LABEL[etapa]}
              </h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-ink-soft/70">
                {porEtapa[etapa].length}
              </span>
            </div>
            <div className="flex flex-col gap-gap-xs">
              {porEtapa[etapa].length === 0 ? (
                <p className="rounded-xl border border-dashed border-ink/10 px-3 py-6 text-center text-meta text-ink-soft/55">
                  Sin prospectos
                </p>
              ) : (
                porEtapa[etapa].map((prospecto) => (
                  <TarjetaProspecto
                    key={prospecto.id}
                    prospecto={prospecto}
                    moviendo={moviendo === prospecto.id}
                    onEditar={() => abrirEditar(prospecto)}
                    onMover={(destino) => void mover(prospecto, destino)}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Móvil: una pestaña por etapa. */}
      <div className="flex flex-col gap-gap-sm lg:hidden">
        <div
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
          role="tablist"
          aria-label="Etapas de prospectos"
        >
          {ETAPAS_PROSPECTO.map((etapa) => (
            <button
              key={etapa}
              type="button"
              role="tab"
              aria-selected={etapaMovil === etapa}
              onClick={() => setEtapaMovil(etapa)}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 font-lv-display text-meta font-semibold transition-colors",
                etapaMovil === etapa
                  ? "border-verde-300 bg-verde-50 text-verde-800"
                  : "border-ink/10 bg-white text-ink-soft/75",
              )}
            >
              {ETAPA_LABEL[etapa]}
              <span className="rounded-full bg-ink/5 px-1.5 text-[10px] tabular-nums">
                {porEtapa[etapa].length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-gap-sm">
          {porEtapa[etapaMovil].length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink/10 bg-white px-gap-md py-10 text-center text-small text-ink-soft/60">
              No hay prospectos en {ETAPA_LABEL[etapaMovil]}.
            </p>
          ) : (
            porEtapa[etapaMovil].map((prospecto) => (
              <TarjetaProspecto
                key={prospecto.id}
                prospecto={prospecto}
                moviendo={moviendo === prospecto.id}
                onEditar={() => abrirEditar(prospecto)}
                onMover={(destino) => void mover(prospecto, destino)}
              />
            ))
          )}
        </div>
      </div>

      <Dialog
        open={abierto}
        onOpenChange={(valor) => {
          if (!guardando) setAbierto(valor);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar prospecto" : "Nuevo prospecto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(event) => void guardar(event)} className="flex flex-col gap-gap-sm">
            <div className="grid grid-cols-1 gap-gap-sm sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Nombre</span>
                <input
                  required
                  maxLength={160}
                  value={draft.nombre}
                  onChange={(event) => setCampo("nombre", event.target.value)}
                  className={INPUT}
                  placeholder="Nombre del negocio o de la persona"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Provincia</span>
                <input
                  required
                  maxLength={80}
                  value={draft.provincia}
                  onChange={(event) => setCampo("provincia", event.target.value)}
                  className={INPUT}
                  placeholder="La Habana"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-gap-sm sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Origen</span>
                <select
                  value={draft.origen}
                  onChange={(event) =>
                    setCampo("origen", event.target.value as OrigenProspecto)
                  }
                  className={`${INPUT} cursor-pointer`}
                >
                  {ORIGENES_PROSPECTO.map((origen) => (
                    <option key={origen} value={origen}>
                      {ORIGEN_LABEL[origen]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL}>
                  {draft.origen === "afiliado"
                    ? "Código del afiliado"
                    : draft.origen === "analytics"
                      ? "Término buscado"
                      : "Detalle (opcional)"}
                </span>
                <input
                  maxLength={160}
                  value={draft.origenDetalle}
                  onChange={(event) => setCampo("origenDetalle", event.target.value)}
                  className={INPUT}
                  placeholder={
                    draft.origen === "afiliado"
                      ? "Ej. ABC123"
                      : draft.origen === "analytics"
                        ? "Ej. cafetería con wifi"
                        : "Ej. recomendación de un vecino"
                  }
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-gap-sm sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Etapa</span>
                <select
                  value={draft.etapa}
                  onChange={(event) =>
                    setCampo("etapa", event.target.value as EtapaProspecto)
                  }
                  className={`${INPUT} cursor-pointer`}
                >
                  {ETAPAS_PROSPECTO.map((etapa) => (
                    <option key={etapa} value={etapa}>
                      {ETAPA_LABEL[etapa]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Fecha del próximo paso</span>
                <input
                  type="date"
                  value={draft.proximoPasoEn}
                  onChange={(event) => setCampo("proximoPasoEn", event.target.value)}
                  className={INPUT}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className={LABEL}>Próximo paso</span>
              <input
                maxLength={300}
                value={draft.proximoPaso}
                onChange={(event) => setCampo("proximoPaso", event.target.value)}
                className={INPUT}
                placeholder="Ej. Llamar el martes y enseñarle el pack"
              />
            </label>

            <div className="grid grid-cols-1 gap-gap-sm sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Responsable</span>
                <select
                  value={draft.adminResponsableId}
                  onChange={(event) =>
                    setCampo("adminResponsableId", event.target.value)
                  }
                  className={`${INPUT} cursor-pointer`}
                >
                  <option value="">Sin responsable</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.nombre || admin.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Negocio enlazado (opcional)</span>
                <select
                  value={draft.negocioId}
                  onChange={(event) => setCampo("negocioId", event.target.value)}
                  className={`${INPUT} cursor-pointer`}
                >
                  <option value="">Todavía sin ficha</option>
                  {places.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className={LABEL}>Notas</span>
              <textarea
                rows={4}
                maxLength={4000}
                value={draft.notas}
                onChange={(event) => setCampo("notas", event.target.value)}
                className={`${AREA} min-h-[100px] resize-y`}
                placeholder="Qué se habló, qué pidió, qué falta…"
              />
            </label>

            {error && (
              <p role="alert" className="text-meta font-semibold text-destructive">
                {error}
              </p>
            )}

            <DialogFooter className="gap-gap-xs sm:gap-gap-xs">
              <DialogClose asChild>
                <button
                  type="button"
                  disabled={guardando}
                  className="inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 px-gap-md text-small font-semibold text-ink-soft/75 disabled:opacity-50"
                >
                  <X size={15} /> Cancelar
                </button>
              </DialogClose>
              <button
                type="submit"
                disabled={guardando}
                className="inline-flex h-11 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 disabled:opacity-50"
              >
                {guardando ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
                {editando ? "Guardar cambios" : "Crear prospecto"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TarjetaProspecto({
  prospecto,
  moviendo,
  onEditar,
  onMover,
}: {
  prospecto: ProspectoAdmin;
  moviendo: boolean;
  onEditar: () => void;
  onMover: (etapa: EtapaProspecto) => void;
}) {
  const anterior = etapaAnterior(prospecto.etapa);
  const fecha = fechaCorta(prospecto.proximoPasoEn);

  return (
    <article
      className={cn(
        "flex flex-col gap-gap-xs rounded-xl border border-ink/5 bg-white p-gap-sm",
        moviendo && "opacity-60",
      )}
      aria-busy={moviendo}
    >
      <div className="flex items-start justify-between gap-gap-xs">
        <div className="min-w-0">
          <h3 className="font-lv-display text-small font-semibold leading-snug text-ink">
            {prospecto.nombre}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-meta text-ink-soft/70">
            <MapPin size={12} className="shrink-0" /> {prospecto.provincia}
          </p>
        </div>
        <button
          type="button"
          onClick={onEditar}
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft/60 transition hover:bg-sand hover:text-ink"
          aria-label={`Editar ${prospecto.nombre}`}
          title="Editar"
        >
          <Pencil size={14} strokeWidth={1.8} />
        </button>
      </div>

      <p className="w-fit rounded-full bg-verde-50 px-2 py-0.5 text-[10px] font-semibold text-verde-800">
        {textoOrigen(prospecto.origen, prospecto.origenDetalle)}
      </p>

      {prospecto.proximoPaso && (
        <div className="rounded-lg bg-sand/60 px-2 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft/50">
            Próximo paso
          </p>
          <p className="mt-0.5 line-clamp-3 text-meta text-ink/85">
            {prospecto.proximoPaso}
          </p>
          {fecha && (
            <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-700">
              <CalendarClock size={11} /> {fecha}
            </p>
          )}
        </div>
      )}

      {prospecto.notas && (
        <p className="line-clamp-2 text-meta text-ink-soft/70">{prospecto.notas}</p>
      )}

      {prospecto.negocioId && (
        <Link
          href={`/admin/negocios/${prospecto.negocioId}/editar`}
          className="inline-flex w-fit items-center gap-1 text-meta font-semibold text-verde-700 hover:underline"
        >
          <Target size={12} /> {prospecto.negocioNombre ?? "Abrir negocio"}
        </Link>
      )}

      <div className="mt-auto flex items-center justify-between gap-gap-xs border-t border-ink/5 pt-gap-xs">
        <p className="flex min-w-0 items-center gap-1 truncate text-[10px] text-ink-soft/60">
          <UserRound size={11} className="shrink-0" />
          {prospecto.adminResponsableNombre ?? "Sin responsable"}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {anterior && (
            <button
              type="button"
              disabled={moviendo}
              onClick={() => onMover(anterior)}
              className="grid size-9 place-items-center rounded-full border border-ink/10 text-ink-soft/70 transition hover:bg-sand disabled:opacity-50"
              aria-label={`Devolver ${prospecto.nombre} a ${ETAPA_LABEL[anterior]}`}
              title={`Volver a ${ETAPA_LABEL[anterior]}`}
            >
              <ArrowLeft size={13} />
            </button>
          )}
          <label className="relative">
            <span className="sr-only">Mover {prospecto.nombre} a otra etapa</span>
            <select
              value=""
              disabled={moviendo}
              onChange={(event) => {
                if (event.target.value) onMover(event.target.value as EtapaProspecto);
              }}
              className="h-9 cursor-pointer appearance-none rounded-full border border-ink/10 bg-white pl-2.5 pr-7 text-[10px] font-semibold text-ink outline-none transition hover:bg-sand disabled:opacity-50"
            >
              <option value="">Mover a…</option>
              {ETAPAS_PROSPECTO.filter((etapa) => etapa !== prospecto.etapa).map(
                (etapa) => (
                  <option key={etapa} value={etapa}>
                    {ETAPA_LABEL[etapa]}
                  </option>
                ),
              )}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft/60"
            />
          </label>
          {moviendo && <Loader2 size={13} className="animate-spin text-verde-600" />}
        </div>
      </div>
    </article>
  );
}

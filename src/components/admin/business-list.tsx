"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Zap, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlaces } from "@/providers/places-provider";
import { placeIcon } from "@/lib/places";
import { CategoryIcon } from "@/components/admin/category-icon";
import { PLAN_LABEL, type PlaceStatus, type UserPlace } from "@/lib/places-store";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";

/* El estado no se distingue por color de marca —el rótulo ya lo dice— pero
   "Cerrado" sí conserva el rojo semántico: es un aviso, no decoración. Antes
   era lv-amber y lv-teal, que no existen en el sistema. */
function statusInfo(status: PlaceStatus): { label: string; cls: string } {
  switch (status) {
    case "closed":
      return { label: "Cerrado", cls: "bg-destructive/10 text-destructive" };
    case "temporary_closed":
      return { label: "Temporal", cls: "bg-sand-deep text-ink-soft/75" };
    default:
      return { label: "Activo", cls: "bg-verde-50 text-verde-600" };
  }
}

/* Misma píldora que la lista de solicitudes, para que el mismo negocio no se
   lea distinto en las dos pantallas. */
const PENDING = { label: "Pendiente", cls: "bg-sand text-ink-soft/75" };

/**
 * La píldora de la fila.
 *
 * `status` es lo que dice el dueño sobre si su negocio está abierto ahora, e
 * `isActive` es lo que dice el sistema sobre si la ficha está publicada. Son
 * cosas distintas y aquí se estaban mezclando: un negocio en solicitudes tiene
 * `status = "active"` —está abierto, es lo que contestó su dueño— pero
 * `is_active = false`, así que salía en verde «Activo» en la lista de negocios
 * mientras la pantalla de solicitudes lo tenía pendiente. Sin publicar manda
 * «Pendiente»: es el dato que le falta al administrador.
 */
function rowStatus(place: UserPlace): { label: string; cls: string } {
  return place.isActive ? statusInfo(place.status) : PENDING;
}

const FILTER =
  "h-[42px] px-3 rounded-xl border border-ink/10 bg-white font-lv-display text-small text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20 cursor-pointer";

/* 44 px en móvil, donde las acciones van en su propia fila y hay sitio; 36 px
   a partir de `sm`, donde la fila vuelve a ser una sola línea y hay que
   apretar. El salto coincide con el del contenedor. */
const ICON_BTN =
  "size-11 sm:size-9 rounded-full border grid place-items-center shrink-0 transition-colors duration-500 ease-outquint";

export function BusinessList() {
  const { places, categories, hydrated, removePlace, updatePlace } = usePlaces();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      /* Publicado **y** abierto. Antes bastaba con `status`, así que un negocio
         sin aprobar —que también tiene `status = "active"`— salía al filtrar
         por «Activos», con la píldora verde al lado. */
      if (statusFilter === "active" && !(p.status === "active" && p.isActive)) return false;
      if (statusFilter === "inactive" && p.status === "active") return false;
      if (statusFilter === "boosted" && !p.isBoosted) return false;
      if (
        q &&
        !`${p.name} ${p.barrio} ${p.category} ${p.address}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [places, query, categoryFilter, statusFilter]);

  /* Los dos esperan la respuesta de la base antes de avisar. El `toast` salía
     antes de que la escritura llegara, así que un fallo de red se celebraba
     como un éxito y el cambio se deshacía al recargar. */
  const handleDelete = useCallback(
    async (p: UserPlace) => {
      if (!window.confirm(`¿Eliminar "${p.name}" de La Verde?`)) return;
      if (await removePlace(p.id)) {
        toast.success(`"${p.name}" se eliminó de La Verde`);
      } else {
        toast.error(`No se pudo eliminar "${p.name}". No se cambió nada.`);
      }
    },
    [removePlace],
  );

  const toggleBoost = useCallback(
    async (p: UserPlace) => {
      const updated = await updatePlace(p.id, { isBoosted: !p.isBoosted });
      if (!updated) {
        toast.error(`No se pudo cambiar el destacado de "${p.name}".`);
        return;
      }
      toast.success(
        p.isBoosted
          ? `Se quitó el destacado de "${p.name}"`
          : `"${p.name}" ahora es Destacado`,
      );
    },
    [updatePlace],
  );

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-md">
        <h1 className="sr-only">Negocios</h1>
        <p className="text-small text-ink-soft/75">
          {places.length} negocios en La Verde
        </p>
        {/* El rótulo se oculta en móvil; el `aria-label` evita que el enlace se
            quede sin nombre accesible al salir el `<span>` del árbol. */}
        <Link
          href="/admin/negocios/nuevo"
          aria-label="Nuevo negocio"
          className="inline-flex items-center gap-gap-xs h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98] shrink-0"
        >
          <Plus size={18} strokeWidth={1.8} />
          <span className="max-sm:hidden">Nuevo negocio</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-gap-sm mb-gap-md">
        <div className="relative flex-1">
          <Search
            size={16}
            strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/75 pointer-events-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, barrio o categoría..."
            aria-label="Buscar negocios"
            className={cn(FILTER, "w-full pl-9 text-body")}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={FILTER}
          aria-label="Filtrar por categoría"
        >
          <option value="all">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.value} value={c.label}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={FILTER}
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Cerrados / Temporales</option>
          <option value="boosted">Destacados</option>
        </select>
      </div>

      {/* List */}
      {!hydrated ? (
        <LoadingState label="Cargando negocios…" />
      ) : filtered.length === 0 ? (
        <StateView
          size="sm"
          icon={MapPin}
          title="No hay negocios que coincidan"
          description="Ajusta los filtros o crea un nuevo negocio."
          className="rounded-2xl border border-ink/5 bg-white shadow-soft"
        />
      ) : (
        <div className="flex flex-col gap-gap-sm">
          {filtered.map((p, i) => {
            const st = rowStatus(p);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                layout
                /* En móvil la fila se parte en dos: arriba el negocio, abajo
                   estado y acciones. En una sola línea, el nombre —que es lo
                   único con `min-w-0`— se encogía hasta desaparecer para dejar
                   sitio a los tres botones. */
                className="bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md flex flex-col gap-gap-sm sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-gap-sm min-w-0 sm:flex-1">
                  <div className="size-11 rounded-2xl bg-verde-50 grid place-items-center text-verde-600 shrink-0">
                    <CategoryIcon
                      icon={placeIcon(p.icon, p.category, categories)}
                      size={22}
                      strokeWidth={1.8}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-gap-xs flex-wrap">
                      <span className="font-lv-display text-small font-semibold text-ink truncate">
                        {p.name}
                      </span>
                      {/* El plan sigue a la ficha después de aprobarla. Si solo
                          se viera en solicitudes, aprobar parecería borrarlo. */}
                      {p.plan && (
                        <span className="inline-flex items-center gap-[4px] rounded-full border border-verde-200 bg-verde-50 px-[7px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-verde-700">
                          {PLAN_LABEL[p.plan]}
                        </span>
                      )}
                      {p.isBoosted && (
                        <span className="inline-flex items-center gap-[4px] px-[7px] py-[2px] rounded-full bg-verde-100 border border-verde-200 font-lv-display text-[10px] font-semibold text-verde-700 uppercase tracking-[0.14em]">
                          <Zap size={10} strokeWidth={1.8} />
                          Destacado
                        </span>
                      )}
                    </div>
                    <div className="font-lv-display text-meta text-ink-soft/75 truncate mt-[2px]">
                      {p.category} · {p.barrio || p.address || "Cuba"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-gap-sm shrink-0">
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center gap-[4px] px-[8px] py-[3px] rounded-full font-lv-display text-[11px] font-semibold",
                      st.cls,
                    )}
                  >
                    <span className="size-[5px] rounded-full bg-current" />
                    {st.label}
                  </span>

                  <div className="flex items-center gap-[6px]">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleBoost(p)}
                      className={cn(
                        ICON_BTN,
                        p.isBoosted
                          ? "border-verde-400 bg-verde-50 text-verde-600"
                          : "border-ink/10 text-ink-soft/75 hover:border-verde-300 hover:text-verde-600 hover:bg-verde-50",
                      )}
                      aria-label="Alternar destacado"
                    >
                      <Zap size={16} strokeWidth={1.8} />
                    </motion.button>
                    <motion.span whileTap={{ scale: 0.9 }} className="inline-block shrink-0">
                      <Link
                        href={`/admin/negocios/${p.id}/editar`}
                        className={cn(
                          ICON_BTN,
                          "border-ink/10 text-ink-soft/75 hover:border-verde-300 hover:text-verde-600 hover:bg-verde-50",
                        )}
                        aria-label="Editar negocio"
                      >
                        <Pencil size={16} strokeWidth={1.8} />
                      </Link>
                    </motion.span>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDelete(p)}
                      className={cn(
                        ICON_BTN,
                        "border-ink/10 text-ink-soft/75 hover:border-destructive hover:text-destructive hover:bg-destructive/5",
                      )}
                      aria-label="Eliminar negocio"
                    >
                      <Trash2 size={16} strokeWidth={1.8} />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}

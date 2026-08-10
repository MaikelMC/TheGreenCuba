"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Zap, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlaces } from "@/providers/places-provider";
import { categoryIcon } from "@/lib/places";
import { CategoryIcon } from "@/components/admin/category-icon";
import type { PlaceStatus, UserPlace } from "@/lib/places-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function statusInfo(status: PlaceStatus): { label: string; cls: string } {
  switch (status) {
    case "closed":
      return { label: "Cerrado", cls: "bg-destructive/10 text-destructive" };
    case "temporary_closed":
      return { label: "Temporal", cls: "bg-lv-amber/10 text-lv-amber" };
    default:
      return { label: "Activo", cls: "bg-lv-teal/10 text-lv-teal" };
  }
}

export function BusinessList() {
  const { places, categories, removePlace, updatePlace } = usePlaces();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (statusFilter === "active" && p.status !== "active") return false;
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

  const handleDelete = useCallback(
    (p: UserPlace) => {
      if (!window.confirm(`¿Eliminar "${p.name}" de La Verde?`)) return;
      removePlace(p.id);
      toast.success(`"${p.name}" se eliminó de La Verde`);
    },
    [removePlace],
  );

  const toggleBoost = useCallback(
    (p: UserPlace) => {
      updatePlace(p.id, { isBoosted: !p.isBoosted });
      toast.success(
        p.isBoosted
          ? `Se quitó el destacado de "${p.name}"`
          : `"${p.name}" ahora es Destacado`,
      );
    },
    [updatePlace],
  );

  const selectCls =
    "h-[42px] px-3 rounded-lv border border-border bg-surface text-small text-foreground outline-none focus:border-accent transition-colors cursor-pointer";

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-lg">
        <div>
          <h1 className="font-display text-h3 font-bold text-foreground">
            Negocios
          </h1>
          <p className="text-small text-muted-foreground mt-gap-2xs">
            {places.length} negocios en La Verde
          </p>
        </div>
        <Link href="/admin/negocios/nuevo">
          <Button>
            <Plus size={18} strokeWidth={1.5} />
            Nuevo negocio
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-gap-sm mb-gap-md">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, barrio o categoría..."
            className="pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={selectCls}
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
          className={selectCls}
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Cerrados / Temporales</option>
          <option value="boosted">Destacados</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-lv-lg p-gap-xl text-center">
          <MapPin
            size={32}
            strokeWidth={1.5}
            className="mx-auto mb-gap-sm text-muted-foreground opacity-40"
          />
          <div className="font-display text-small font-semibold text-foreground mb-[4px]">
            No hay negocios que coincidan
          </div>
          <div className="text-meta text-muted-foreground">
            Ajusta los filtros o crea un nuevo negocio.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-gap-sm">
          {filtered.map((p, i) => {
            const st = statusInfo(p.status);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                layout
                className="bg-surface border border-border rounded-lv-lg p-gap-md flex items-center gap-gap-sm"
              >
                <div className="size-11 rounded-lv bg-gradient-to-br from-accent/10 to-lv-green-200/15 grid place-items-center text-foreground/70 shrink-0">
                  <CategoryIcon
                    icon={categoryIcon(p.category)}
                    size={22}
                    strokeWidth={1.6}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-gap-xs flex-wrap">
                    <span className="font-display text-small font-semibold text-foreground truncate">
                      {p.name}
                    </span>
                    {p.isBoosted && (
                      <span className="inline-flex items-center gap-[4px] px-[7px] py-[2px] rounded-full bg-lv-amber/10 border border-lv-amber/25 font-mono text-[10px] font-medium text-lv-amber uppercase tracking-[0.03em]">
                        <Zap size={10} strokeWidth={2} />
                        Destacado
                      </span>
                    )}
                  </div>
                  <div className="text-meta text-muted-foreground truncate mt-[2px]">
                    {p.category} · {p.barrio || p.address || "Cuba"}
                  </div>
                </div>

                <span
                  className={cn(
                    "shrink-0 inline-flex items-center gap-[4px] px-[8px] py-[3px] rounded-full font-mono text-[11px] font-medium",
                    st.cls,
                  )}
                >
                  <span className="size-[5px] rounded-full bg-current" />
                  {st.label}
                </span>

                <div className="shrink-0 flex items-center gap-[4px]">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleBoost(p)}
                    className={cn(
                      "size-9 rounded-lv border grid place-items-center transition-colors",
                      p.isBoosted
                        ? "border-lv-amber/40 text-lv-amber bg-lv-amber/8"
                        : "border-border text-muted-foreground hover:border-lv-amber hover:text-lv-amber",
                    )}
                    aria-label="Alternar destacado"
                  >
                    <Zap size={16} strokeWidth={2} />
                  </motion.button>
                  <motion.span whileTap={{ scale: 0.9 }} className="inline-block">
                    <Link
                      href={`/admin/negocios/${p.id}/editar`}
                      className="size-9 rounded-lv border border-border grid place-items-center text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                      aria-label="Editar negocio"
                    >
                      <Pencil size={16} strokeWidth={2} />
                    </Link>
                  </motion.span>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleDelete(p)}
                    className="size-9 rounded-lv border border-border grid place-items-center text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                    aria-label="Eliminar negocio"
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}

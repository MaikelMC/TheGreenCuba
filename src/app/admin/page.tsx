"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Plus, AlertTriangle, Store } from "lucide-react";
import { usePlaces } from "@/providers/places-provider";
import { DashboardStats } from "@/components/business/dashboard-stats";
import { MiniChart } from "@/components/business/mini-chart";
import { CategoryIcon } from "@/components/admin/category-icon";

export default function AdminDashboardPage() {
  const { places, categories } = usePlaces();

  const stats = useMemo(() => {
    const approved = places.filter((p) => p.reviewStatus === "approved");
    const total = approved.length;
    const active = approved.filter((p) => p.isActive && p.status === "active").length;
    const closed = total - active;
    const boosted = approved.filter((p) => p.isBoosted).length;
    return { total, active, closed, boosted };
  }, [places]);

  const byCategory = useMemo(
    () =>
      categories
        .map((c) => ({
          label: c.label,
          icon: c.icon,
          count: places.filter((p) => p.reviewStatus === "approved" && p.category === c.label).length,
        }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count),
    [places, categories],
  );

  const attention = useMemo(
    () =>
      places.filter(
        (p) => p.reviewStatus === "approved" && (p.status !== "active" || !p.description?.trim()),
      ),
    [places],
  );

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-md">
        <h1 className="sr-only">Dashboard</h1>
        <p className="text-small text-ink-soft/75">
          Resumen de toda la plataforma La Verde
        </p>
        {/* En móvil el rótulo se oculta y queda solo el icono. Sin el
            `aria-label` el enlace se quedaría sin nombre accesible: `hidden`
            saca el `<span>` del árbol de accesibilidad. */}
        <Link
          href="/admin/negocios/nuevo"
          aria-label="Nuevo negocio"
          className="inline-flex items-center gap-gap-xs h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98] shrink-0"
        >
          <Plus size={18} strokeWidth={1.8} />
          <span className="max-sm:hidden">Nuevo negocio</span>
        </Link>
      </div>

      <DashboardStats
        stats={[
          {
            label: "Negocios totales",
            value: String(stats.total),
            change: { value: `${stats.active} activos`, direction: "up" },
          },
          {
            label: "Activos",
            value: String(stats.active),
            change: {
              value: `${((stats.active / Math.max(stats.total, 1)) * 100).toFixed(0)}% del total`,
              direction: "up",
            },
          },
          {
            label: "Destacados",
            value: String(stats.boosted),
            change: {
              value: stats.boosted > 0 ? "Plan activo" : "Sin destacados",
              direction: stats.boosted > 0 ? "up" : "neutral",
            },
          },
          {
            label: "Cerrados / Temporales",
            value: String(stats.closed),
            change: {
              value: stats.closed > 0 ? "Requieren revisión" : "Todo en orden",
              direction: stats.closed > 0 ? "down" : "neutral",
            },
          },
        ]}
      />

      <div className="mt-gap-lg grid grid-cols-1 lg:grid-cols-3 gap-gap-md">
        <div className="lg:col-span-2 space-y-gap-md">
          <MiniChart
            data={byCategory.map((c) => c.count)}
            labels={byCategory
              .slice(0, 4)
              .map((c) => (
                <CategoryIcon key={c.label} icon={c.icon} size={14} strokeWidth={1.8} />
              ))}
            title="Negocios por categoría"
            period={categories.length === byCategory.length ? "Todas las categorías" : "Con negocios"}
          />

          <div className="bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md">
            <h3 className="font-lv-display text-body font-semibold text-ink mb-gap-sm">
              Negocios que requieren atención
            </h3>
            {attention.length === 0 ? (
              <div className="text-meta text-ink-soft/75 py-gap-sm">
                Todo en orden. No hay negocios cerrados ni sin descripción.
              </div>
            ) : (
              <div className="flex flex-col">
                {attention.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-gap-sm py-gap-sm border-b border-ink/5 last:border-b-0"
                  >
                    <AlertTriangle
                      size={16}
                      strokeWidth={1.8}
                      className="text-verde-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-lv-display text-small font-semibold text-ink truncate">
                        {p.name}
                      </div>
                      <div className="text-meta text-ink-soft/75 truncate">
                        {p.status !== "active"
                          ? p.status === "closed"
                            ? "Cerrado"
                            : "Temporalmente cerrado"
                          : "Sin descripción"}
                        {p.description?.trim() ? "" : " · Sin descripción"}
                      </div>
                    </div>
                    <Link
                      href={`/admin/negocios/${p.id}/editar`}
                      className="font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-verde-600 hover:text-verde-700 transition-colors duration-500 ease-outquint shrink-0"
                    >
                      Editar
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md h-fit">
          <h3 className="font-lv-display text-body font-semibold text-ink mb-gap-sm">
            Distribución por categoría
          </h3>
          {byCategory.length === 0 ? (
            <div className="text-meta text-ink-soft/75 py-gap-sm">
              Aún no hay negocios.
            </div>
          ) : (
            <div className="flex flex-col gap-gap-xs">
              {byCategory.map((c, i) => (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center justify-between py-gap-xs border-b border-ink/5 last:border-b-0"
                >
                  <span className="inline-flex items-center gap-2 text-small text-ink">
                    <CategoryIcon
                      icon={c.icon}
                      size={16}
                      strokeWidth={1.8}
                      className="text-verde-600"
                    />
                    {c.label}
                  </span>
                  <span className="inline-flex items-center px-[8px] py-[2px] rounded-full bg-verde-50 text-verde-600 border border-verde-200 font-lv-display text-meta font-semibold">
                    {c.count}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
          <div className="mt-gap-md p-gap-md bg-sand border border-ink/5 rounded-2xl">
            <Store size={18} strokeWidth={1.8} className="text-verde-600 mb-gap-xs" />
            <p className="text-small text-ink-soft/75 leading-relaxed">
              Gestiona los negocios de La Verde en{" "}
              <Link href="/admin/negocios" className="text-verde-600 font-semibold hover:text-verde-700">
                Negocios
              </Link>
              . Puedes agregar, editar, eliminar, destacar y cambiar el estado de cada uno.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

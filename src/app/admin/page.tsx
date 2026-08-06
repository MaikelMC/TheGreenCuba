"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, AlertTriangle, Store } from "lucide-react";
import { usePlaces } from "@/providers/places-provider";
import { DashboardStats } from "@/components/business/dashboard-stats";
import { MiniChart } from "@/components/business/mini-chart";
import { CategoryIcon } from "@/components/admin/category-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboardPage() {
  const { places, categories } = usePlaces();

  const stats = useMemo(() => {
    const total = places.length;
    const active = places.filter((p) => p.status === "active").length;
    const closed = total - active;
    const boosted = places.filter((p) => p.isBoosted).length;
    return { total, active, closed, boosted };
  }, [places]);

  const byCategory = useMemo(
    () =>
      categories
        .map((c) => ({
          label: c.label,
          icon: c.icon,
          count: places.filter((p) => p.category === c.label).length,
        }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count),
    [places, categories],
  );

  const attention = useMemo(
    () =>
      places.filter(
        (p) => p.status !== "active" || !p.description?.trim(),
      ),
    [places],
  );

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-lg">
        <div>
          <h1 className="font-display text-h3 font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-small text-muted-foreground mt-gap-2xs">
            Resumen de toda la plataforma La Verde
          </p>
        </div>
        <Link href="/admin/negocios/nuevo">
          <Button>
            <Plus size={18} strokeWidth={1.5} />
            Nuevo negocio
          </Button>
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

          <div className="bg-surface border border-border rounded-lv-lg p-gap-md">
            <h3 className="font-display text-body font-semibold text-foreground mb-gap-sm">
              Negocios que requieren atención
            </h3>
            {attention.length === 0 ? (
              <div className="text-meta text-muted-foreground py-gap-sm">
                Todo en orden. No hay negocios cerrados ni sin descripción.
              </div>
            ) : (
              <div className="flex flex-col">
                {attention.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-gap-sm py-gap-sm border-b border-border last:border-b-0"
                  >
                    <AlertTriangle
                      size={16}
                      strokeWidth={2}
                      className="text-lv-amber shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-small font-semibold truncate">
                        {p.name}
                      </div>
                      <div className="text-meta text-muted-foreground truncate">
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
                      className="font-mono text-xs font-medium text-accent uppercase tracking-[0.04em] hover:text-accent-hover transition-colors shrink-0"
                    >
                      Editar
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lv-lg p-gap-md h-fit">
          <h3 className="font-display text-body font-semibold text-foreground mb-gap-sm">
            Distribución por categoría
          </h3>
          {byCategory.length === 0 ? (
            <div className="text-meta text-muted-foreground py-gap-sm">
              Aún no hay negocios.
            </div>
          ) : (
            <div className="flex flex-col gap-gap-xs">
              {byCategory.map((c) => (
                <div
                  key={c.label}
                  className="flex items-center justify-between py-gap-xs border-b border-border last:border-b-0"
                >
                  <span className="inline-flex items-center gap-2 text-small text-foreground">
                    <CategoryIcon
                      icon={c.icon}
                      size={16}
                      strokeWidth={1.8}
                      className="text-muted-foreground"
                    />
                    {c.label}
                  </span>
                  <Badge variant="secondary">{c.count}</Badge>
                </div>
              ))}
            </div>
          )}
          <div className="mt-gap-md p-gap-md bg-muted rounded-lv-lg">
            <Store size={18} strokeWidth={1.5} className="text-accent mb-gap-xs" />
            <p className="text-small text-muted-foreground leading-relaxed">
              Gestiona los negocios de La Verde en{" "}
              <Link href="/admin/negocios" className="text-accent font-medium hover:underline">
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

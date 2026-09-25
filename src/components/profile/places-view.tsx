"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Bookmark, Eye, Info, Sparkles, TrendingUp } from "lucide-react";
import { CategoryIcon } from "@/components/admin/category-icon";
import { MiniChart } from "@/components/business/mini-chart";
import { categoryIcon } from "@/lib/places";
import { EASE } from "@/lib/motion";
import {
  dailyHistogram,
  dayLabels,
  placeCount,
  readActivity,
  relativeDay,
  savedVisits,
  topCategory,
  topVisits,
  type ActivityState,
} from "@/lib/activity-store";

interface SavedPlaceItem {
  placeId: string;
  name: string;
  category: string;
  savedAt: string | null;
}

/* Estado mientras no hay nada guardado en este navegador. Es el mismo objeto
   EMPTY del store, repetido aquí porque `activity` empieza en `null` mientras
   carga y toda derivada necesita algo contra qué correr. */
const EMPTY_ACTIVITY: ActivityState = { visits: [], savedIds: [], stamps: [] };

/**
 * «Mis lugares»: lo que este navegador sabe de tu uso.
 *
 * No hay analítica detrás. Estas cifras son las de aquí, y por eso la pantalla
 * no dice «popular» ni «tendencia»: dice cuántas veces has abierto cada sitio
 * tú. Antes, con cero actividad, se rellenaba con un historial de ejemplo; ya
 * no — los ceros son ceros de verdad y el aviso lo dice sin adornos.
 */
export function PlacesView() {
  const [activity, setActivity] = useState<ActivityState | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetch("/api/me")
      .then((res) => res.json())
      .then((data: { authenticated?: boolean; user?: { id?: string } | null }) => {
        if (!alive) return;
        const nextUserId = data.authenticated && data.user?.id ? data.user.id : null;
        setUserId(nextUserId);
        setActivity(readActivity(nextUserId));
      })
      .catch(() => {
        if (!alive) return;
        setUserId(null);
        setActivity(readActivity(null));
      });

    fetch("/api/me/places")
      .then((res) => res.json())
      .then((data: { authenticated?: boolean; saved?: SavedPlaceItem[] }) => {
        if (data.authenticated && Array.isArray(data.saved)) {
          setSavedPlaces(data.saved);
        }
      })
      .catch(() => {
        setSavedPlaces([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  if (!activity) {
    return (
      <p className="py-gap-2xl text-center text-small text-ink-soft/75" aria-busy>
        Cargando tu actividad…
      </p>
    );
  }

  const state = activity ?? EMPTY_ACTIVITY;
  const top = topVisits(state, 5);
  const saved = savedPlaces.length > 0 ? savedPlaces : savedVisits(state);
  const category = topCategory(state);
  const lastVisit = topVisits(state, 1)[0];
  const max = Math.max(...top.map((v) => v.count), 1);

  return (
    <div className="places-activity flex flex-col gap-gap-xl">
      {/* Sin cabecera propia: el título de la sección ya lo dice la barra
          superior del perfil, y repetirlo aquí era decir lo mismo dos veces. */}
      {top.length === 0 && saved.length === 0 && (
        <p className="flex items-start gap-gap-xs rounded-2xl border border-verde-200 bg-verde-50 px-gap-sm py-gap-xs text-meta text-verde-700">
          <Info size={15} strokeWidth={1.8} className="mt-[1px] shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Aún no hay nada que medir.</strong> Explora el mapa,
            abre fichas y guarda lo que te interese: aquí aparecerá tu actividad, solo con datos
            reales.
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-gap-sm">
        <Stat label="Lugares vistos" value={String(placeCount(state))} icon={Eye} />
        <Stat label="Guardados" value={String(savedPlaces.length || activity?.savedIds.length || 0)} icon={Bookmark} />
        <Stat label="Lo que más ves" value={category?.label ?? "—"} icon={Sparkles} />
        <Stat
          label="Última visita"
          value={lastVisit ? relativeDay(lastVisit.lastAt) : "—"}
          icon={TrendingUp}
        />
      </div>

      <MiniChart
        data={dailyHistogram(state)}
        labels={dayLabels()}
        title="Lugares abiertos por día"
        period="Últimos 14 días"
        className="activity-surface shadow-none"
      />

      <section className="activity-surface flex flex-col gap-gap-md rounded-2xl border border-ink/5 bg-white p-gap-md">
        <h2 className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
          Los que más abres
        </h2>

        <ol className="flex flex-col gap-gap-md">
          {top.map((v, i) => (
            <motion.li
              key={v.placeId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: EASE }}
            >
              <Link
                href={`/place/${v.placeId}`}
                className="group flex flex-col gap-gap-xs rounded-xl transition-colors duration-500 ease-outquint"
              >
                <span className="flex items-center gap-gap-sm">
                  <span className="w-4 shrink-0 font-lv-display text-meta font-semibold text-ink-soft/75">
                    {i + 1}
                  </span>
                  <span aria-hidden className="shrink-0 text-verde-600">
                    <CategoryIcon icon={categoryIcon(v.category)} size={16} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-small font-medium text-ink transition-colors duration-500 ease-outquint group-hover:text-verde-600">
                    {v.name}
                  </span>
                  <span className="shrink-0 font-lv-display text-meta text-ink-soft/75">
                    {v.count} {v.count === 1 ? "apertura" : "aperturas"}
                  </span>
                </span>
                <span className="ml-4 flex h-[6px] overflow-hidden rounded-full bg-sand-deep">
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${(v.count / max) * 100}%` }}
                    transition={{ delay: 0.15 + i * 0.05, duration: 0.6, ease: EASE }}
                    className="rounded-full bg-verde-400"
                  />
                </span>
              </Link>
            </motion.li>
          ))}
        </ol>
      </section>

      {saved.length > 0 && (
        <section className="activity-surface flex flex-col gap-gap-md rounded-2xl border border-ink/5 bg-white p-gap-md">
          <h2 className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
            Guardados
          </h2>
          <ul className="flex flex-col">
            {saved.map((v) => (
              <li key={v.placeId}>
                <Link
                  href={`/place/${v.placeId}`}
                  className="flex items-center gap-gap-sm border-b border-ink/5 py-gap-sm text-small text-ink transition-colors duration-500 ease-outquint last:border-b-0 hover:text-verde-600"
                >
                  <span aria-hidden className="shrink-0 text-verde-600">
                    <CategoryIcon icon={categoryIcon(v.category)} size={16} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{v.name}</span>
                  <Bookmark size={14} strokeWidth={1.8} className="shrink-0 text-verde-500" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* Tarjeta de cifra sin el chip de tendencia que lleva `DashboardStats`: aquí no
   hay serie contra la que comparar, y un «= mismo» de relleno sería peor que
   no poner nada. */
function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Eye;
}) {
  return (
    <div className="activity-surface flex flex-col gap-gap-xs rounded-2xl border border-ink/5 bg-white p-gap-md">
      <span className="flex items-center gap-[6px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
        <Icon size={13} strokeWidth={1.8} className="shrink-0" aria-hidden />
        {label}
      </span>
      <span className="font-lv-display text-[24px] font-bold leading-none tracking-[-0.02em] text-ink">
        {value}
      </span>
    </div>
  );
}

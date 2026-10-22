"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BadgeCheck,
  ChevronRight,
  Flame,
  MapPin,
  RefreshCw,
  X,
} from "lucide-react";
import { PuntoNuevo } from "@/components/ui/punto-nuevo";
import { formatDistanceM } from "@/lib/map/routing";
import { etiquetaTipo, type NovedadHome } from "@/lib/novedades";
import { categoryEmoji } from "@/lib/places";

interface Props {
  ubicacion: { lat: number; lng: number } | null;
  provincia: string | null;
  userId: string | null;
}

const ESTILO_TIPO: Record<NovedadHome["tipo"], string> = {
  oferta: "bg-lv-red/10 text-lv-red",
  producto_nuevo: "bg-verde-100 text-verde-800",
  cambio_precio: "bg-amber-100 text-amber-800",
  actualizacion: "bg-ink/5 text-ink-soft",
};

const RELATIVO = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** «ahora», «hace 5 min», «hace 2 h», «ayer». */
function tiempoRelativo(ms: number): string {
  const minutos = Math.round((Date.now() - ms) / 60_000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return RELATIVO.format(-minutos, "minute");
  const horas = Math.round(minutos / 60);
  if (horas < 24) return RELATIVO.format(-horas, "hour");
  return RELATIVO.format(-Math.round(horas / 24), "day");
}

/**
 * El botón de fuego sobre el mapa y su panel de novedades.
 *
 * Se pide al servidor cuando hay ubicación o, si todavía no llegó el GPS, la
 * provincia del perfil. En ese segundo caso se espera poco más de un segundo:
 * el home pide la ubicación al montar y casi siempre llega antes, así que
 * lanzar la petición con solo la provincia y repetirla con las coordenadas
 * sería pedir lo mismo dos veces con veinte datos de diferencia.
 *
 * El punto que late significa «hay algo desde la última vez que abriste». Esa
 * marca vive en `localStorage` por usuario —o por invitado—: no hace falta una
 * columna para lo que solo importa en este dispositivo.
 */
export function NovedadesMapa({ ubicacion, provincia, userId }: Props) {
  const [items, setItems] = useState<NovedadHome[]>([]);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">(
    "cargando",
  );
  const [open, setOpen] = useState(false);
  /* Arranca en «ahora» para que quien ya abrió el panel no vea el punto un
     instante antes de que `localStorage` diga su marca real. El efecto de abajo
     la pisa enseguida; sin marca guardada queda en 0 y el punto sí se enciende. */
  const [vistas, setVistas] = useState(() => Date.now());
  const [refresco, setRefresco] = useState(0);
  const [montado, setMontado] = useState(false);
  const dialogo = useRef<HTMLDivElement>(null);
  const reducir = useReducedMotion();

  const clave = `la-verde:novedades-vistas:${userId ?? "guest"}`;
  /* Dos decimales (~1 km) para no repetir la petición por una mejora de
     precisión del GPS que no cambia lo que hay cerca. */
  const lat = ubicacion ? ubicacion.lat.toFixed(2) : null;
  const lng = ubicacion ? ubicacion.lng.toFixed(2) : null;

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(clave);
      setVistas(guardado ? Number(guardado) || 0 : 0);
    } catch {
      setVistas(0);
    }
  }, [clave]);

  useEffect(() => {
    if (!lat && !provincia) {
      setItems([]);
      setEstado("listo");
      return;
    }

    const controller = new AbortController();
    let espera: ReturnType<typeof setTimeout> | undefined;

    async function cargar() {
      setEstado("cargando");
      const params = new URLSearchParams();
      if (lat && lng) {
        params.set("lat", lat);
        params.set("lng", lng);
      }
      if (provincia) params.set("provincia", provincia);

      try {
        const response = await fetch(`/api/novedades?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("respuesta");
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("formato");
        setItems(data as NovedadHome[]);
        setEstado("listo");
      } catch {
        if (controller.signal.aborted) return;
        setEstado("error");
      }
    }

    if (lat && lng) {
      void cargar();
    } else {
      espera = setTimeout(() => void cargar(), 1200);
    }

    return () => {
      controller.abort();
      if (espera) clearTimeout(espera);
    };
  }, [lat, lng, provincia, refresco]);

  useEffect(() => {
    if (!open) return;

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const enfoque = setTimeout(() => dialogo.current?.focus(), 30);

    return () => {
      document.body.style.overflow = overflowPrevio;
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(enfoque);
    };
  }, [open]);

  function abrir() {
    setOpen(true);
    const ahora = Date.now();
    setVistas(ahora);
    try {
      localStorage.setItem(clave, String(ahora));
    } catch {
      /* Sin almacenamiento el punto se apaga solo hasta la próxima carga. */
    }
    setRefresco((n) => n + 1);
  }

  const hayNuevo = items.some((item) => item.createdAt > vistas);
  const hayOfertas = items.some((item) => item.tipo === "oferta");

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={abrir}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          hayOfertas
            ? "Novedades cerca de ti, hay ofertas"
            : hayNuevo
              ? "Novedades cerca de ti, hay novedades"
              : "Novedades cerca de ti"
        }
        className={`relative grid size-11 place-items-center rounded-full border bg-white shadow-soft transition-colors duration-500 ease-outquint ${
          hayOfertas
            ? "border-lv-red/20 text-lv-red hover:border-lv-red/40"
            : "border-ink/10 text-ink hover:border-verde-300 hover:text-verde-600"
        }`}
      >
        <span className="relative grid place-items-center">
          {/* Dos halos desfasados: uno ancho y tenue que alumbra el botón, otro
              más pegado a la llama. Los períodos distintos evitan que el brillo
              se vea como un latido mecánico. */}
          {hayOfertas && (
            <>
              <motion.span
                aria-hidden
                className="absolute size-11 rounded-full bg-lv-red/40 blur-[10px]"
                animate={
                  reducir
                    ? { opacity: 0.5, scale: 1 }
                    : {
                        opacity: [0.28, 0.62, 0.34, 0.56, 0.28],
                        scale: [0.9, 1.18, 1, 1.14, 0.9],
                      }
                }
                transition={
                  reducir
                    ? { duration: 0 }
                    : {
                        duration: 3.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                        times: [0, 0.25, 0.5, 0.75, 1],
                      }
                }
              />
              <motion.span
                aria-hidden
                className="absolute size-6 rounded-full bg-lv-red/50 blur-[4px]"
                animate={
                  reducir
                    ? { opacity: 0.55, scale: 1 }
                    : {
                        opacity: [0.4, 0.8, 0.5, 0.75, 0.4],
                        scale: [0.92, 1.12, 0.98, 1.08, 0.92],
                      }
                }
                transition={
                  reducir
                    ? { duration: 0 }
                    : {
                        duration: 2.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                        times: [0, 0.22, 0.5, 0.78, 1],
                      }
                }
              />
            </>
          )}
          <motion.span
            className="relative grid place-items-center"
            style={{ transformOrigin: "50% 90%" }}
            animate={
              hayOfertas && !reducir
                ? {
                    scaleY: [1, 1.08, 0.96, 1.05, 1],
                    rotate: [0, -2.5, 1.5, -1, 0],
                  }
                : undefined
            }
            transition={
              hayOfertas && !reducir
                ? {
                    duration: 2.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.2, 0.5, 0.75, 1],
                  }
                : undefined
            }
          >
            <Flame
              size={18}
              strokeWidth={hayOfertas ? 2 : 1.8}
              className={hayOfertas ? "fill-lv-red/25" : undefined}
            />
          </motion.span>
        </span>
        {hayNuevo && <PuntoNuevo className="right-[2px] top-[2px]" />}
      </motion.button>

      {montado &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                className="fixed inset-0 z-[400]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  aria-hidden
                  onClick={() => setOpen(false)}
                  className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
                />

                <motion.div
                  ref={dialogo}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="novedades-titulo"
                  tabIndex={-1}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col overflow-hidden rounded-t-4xl bg-white shadow-card outline-none"
                >
                  {/* La pestaña también cierra: es lo que se toca cuando la
                      hoja ya está abierta y la X queda lejos del pulgar. */}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar novedades"
                    className="mx-auto flex h-7 w-16 shrink-0 items-center justify-center"
                  >
                    <span className="h-1 w-10 rounded-full bg-ink/15" />
                  </button>

                  <header className="flex items-start justify-between gap-3 px-gap-md pb-gap-sm pt-gap-sm">
                    <div className="min-w-0">
                      <h2
                        id="novedades-titulo"
                        className="font-lv-display text-h3 font-semibold text-ink"
                      >
                        Novedades cerca de ti
                      </h2>
                      <p className="mt-[2px] text-meta text-ink-soft/75">
                        {provincia
                          ? `Cerca de ti y en ${provincia}`
                          : "Ofertas y cambios de los negocios de tu zona"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Cerrar novedades"
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-sand text-ink-soft transition-colors duration-500 ease-outquint hover:bg-sand-deep hover:text-ink"
                    >
                      <X size={17} strokeWidth={1.8} />
                    </button>
                  </header>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-ink/5 pb-safe-bottom">
                    {estado === "cargando" && items.length === 0 ? (
                      <div className="space-y-gap-xs p-gap-sm">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="flex gap-gap-sm rounded-2xl border border-ink/5 bg-sand-warm p-gap-sm"
                          >
                            <div className="size-16 shrink-0 animate-pulse rounded-xl bg-sand-deep" />
                            <div className="flex-1 space-y-[7px] pt-1">
                              <div className="h-2.5 w-2/5 animate-pulse rounded-full bg-sand-deep" />
                              <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-sand-deep" />
                              <div className="h-3 w-3/5 animate-pulse rounded-full bg-sand" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : estado === "error" && items.length === 0 ? (
                      <div className="px-gap-md py-12 text-center">
                        <RefreshCw
                          size={24}
                          strokeWidth={1.7}
                          className="mx-auto text-ink-soft/60"
                        />
                        <p className="mt-2 font-lv-display text-small font-semibold text-ink">
                          No pudimos cargar las novedades
                        </p>
                        <button
                          type="button"
                          onClick={() => setRefresco((n) => n + 1)}
                          className="mt-gap-sm rounded-full border border-ink/10 px-4 py-2 text-small font-semibold text-verde-700 transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50"
                        >
                          Reintentar
                        </button>
                      </div>
                    ) : items.length === 0 ? (
                      <div className="px-gap-md py-12 text-center">
                        <Flame
                          size={24}
                          strokeWidth={1.7}
                          className="mx-auto text-verde-600"
                        />
                        <p className="mt-2 font-lv-display text-small font-semibold text-ink">
                          Nada nuevo por aquí todavía
                        </p>
                        <p className="mt-1 text-meta leading-relaxed text-ink-soft/75">
                          {lat || provincia
                            ? "Cuando un negocio con plan de tu zona publique una oferta o cambie su carta, aparecerá aquí."
                            : "Activa tu ubicación para ver lo que hay cerca de ti."}
                        </p>
                      </div>
                    ) : (
                      <ul className="space-y-gap-xs p-gap-sm">
                        {items.map((item) => {
                          const esOferta = item.tipo === "oferta";
                          return (
                            <li key={item.id}>
                              <Link
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className={`group flex items-start gap-gap-sm rounded-2xl border p-gap-sm transition-colors duration-500 ease-outquint ${
                                  esOferta
                                    ? "border-lv-red/15 bg-lv-red/[0.04] hover:border-lv-red/30 hover:bg-lv-red/[0.07]"
                                    : "border-ink/5 bg-sand-warm hover:border-verde-200 hover:bg-white"
                                }`}
                              >
                                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-ink/5 bg-sand">
                                  <span className="grid size-full place-items-center text-2xl">
                                    {categoryEmoji(item.categoria ?? "")}
                                  </span>
                                  {item.imagenUrl && (
                                    <img
                                      src={item.imagenUrl}
                                      alt=""
                                      loading="lazy"
                                      onError={(event) =>
                                        event.currentTarget.remove()
                                      }
                                      className="absolute inset-0 size-full object-cover"
                                    />
                                  )}
                                  {esOferta && (
                                    <span className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-full bg-lv-red text-white shadow-soft">
                                      <Flame
                                        size={11}
                                        strokeWidth={2.2}
                                        aria-hidden
                                      />
                                    </span>
                                  )}
                                </span>

                                <span className="min-w-0 flex-1">
                                  <span className="flex min-w-0 items-center gap-[5px]">
                                    <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft/70">
                                      {item.negocioNombre}
                                    </span>
                                    <span
                                      title="Negocio verificado"
                                      className="shrink-0 text-verde-600"
                                    >
                                      <BadgeCheck
                                        size={13}
                                        strokeWidth={2}
                                        aria-hidden
                                      />
                                      <span className="sr-only">
                                        Negocio verificado
                                      </span>
                                    </span>
                                    {item.distanciaM != null && (
                                      <span className="ml-auto inline-flex shrink-0 items-center gap-[3px] text-[11px] font-medium text-ink-soft/60">
                                        <MapPin
                                          size={11}
                                          strokeWidth={1.8}
                                          aria-hidden
                                        />
                                        {formatDistanceM(item.distanciaM)}
                                      </span>
                                    )}
                                  </span>

                                  <span className="mt-[5px] flex flex-wrap items-center gap-x-[6px] gap-y-1">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.12em] ${ESTILO_TIPO[item.tipo]}`}
                                    >
                                      {etiquetaTipo(item.tipo)}
                                    </span>
                                    <span className="text-[11px] text-ink-soft/55">
                                      {tiempoRelativo(item.createdAt)}
                                    </span>
                                  </span>

                                  <span className="mt-[5px] block font-lv-display text-small font-semibold leading-snug text-ink">
                                    {item.titulo}
                                  </span>
                                  {item.texto && (
                                    <span className="mt-[2px] line-clamp-2 block text-meta leading-relaxed text-ink-soft/75">
                                      {item.texto}
                                    </span>
                                  )}

                                  {(item.precioAntes || item.precioAhora) && (
                                    <span className="mt-[6px] flex items-baseline gap-[6px]">
                                      {item.precioAntes &&
                                        item.precioAhora &&
                                        item.precioAntes !==
                                          item.precioAhora && (
                                          <s className="text-[11px] text-ink-soft/55">
                                            {item.precioAntes}
                                          </s>
                                        )}
                                      {item.precioAhora && (
                                        <span className="font-lv-display text-small font-bold text-verde-700">
                                          {item.precioAhora}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </span>

                                <ChevronRight
                                  size={15}
                                  strokeWidth={1.8}
                                  aria-hidden
                                  className="shrink-0 self-center text-ink-soft/35 transition-transform duration-300 ease-outquint group-hover:translate-x-[2px] group-hover:text-ink-soft/60"
                                />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

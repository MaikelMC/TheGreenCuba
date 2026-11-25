"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import type {
  DatosNegociosAdmin,
  EstadoPublicacionNegocio,
  FiltroNegocios,
  NegocioAdminFila,
  OrdenNegocios,
} from "@/lib/admin-negocios";
import {
  TIPOS_NEGOCIO,
  TIPO_NEGOCIO_LABEL,
  type TipoNegocio,
} from "@/lib/ficha/tipos";
import { EnlaceNegocio } from "./enlace-negocio";
import { BarraProgreso } from "./ui/progreso";
import { BotonAdmin, BotonIconoAdmin } from "./ui/botones";
import { ChapitaEstado } from "./ui/chapita";
import { EstadoVacioAdmin } from "./ui/tarjeta";

/**
 * La tabla de Negocios.
 *
 * Los datos vienen ya filtrados, ordenados y paginados desde el servidor; esta
 * pieza solo pinta, guarda la selección y pide las acciones. Los filtros y la
 * página viven en la URL, así que recargar o compartir el enlace conserva la
 * vista. En móvil la misma información se lee como tarjetas.
 */

type Tono = "ok" | "aviso" | "error" | "info" | "neutra";

const CHIPS: { id: FiltroNegocios; etiqueta: string }[] = [
  { id: "todos", etiqueta: "Todos" },
  { id: "prueba", etiqueta: "Prueba vence" },
  { id: "impagos", etiqueta: "Impagos" },
  { id: "sin_fotos", etiqueta: "Sin fotos" },
  { id: "sin_actividad", etiqueta: "Sin actividad 30 días" },
  { id: "sin_tipo", etiqueta: "Sin tipo" },
];

const ETIQUETA_ESTADO: Record<EstadoPublicacionNegocio, string> = {
  publicado: "Publicado",
  pendiente: "Pendiente",
  rechazado: "Rechazado",
  oculto: "Oculto",
  cerrado: "Cerrado",
  temporal: "Temporal",
};

const TONO_ESTADO: Record<EstadoPublicacionNegocio, Tono> = {
  publicado: "ok",
  pendiente: "aviso",
  rechazado: "error",
  oculto: "neutra",
  cerrado: "error",
  temporal: "aviso",
};

const TONO_PAGO: Record<NegocioAdminFila["pago"]["estado"], Tono> = {
  al_dia: "ok",
  prueba: "aviso",
  vencida: "error",
  pendiente: "aviso",
  gratis: "neutra",
  cancelada: "error",
};

const INPUT =
  "h-[42px] w-full rounded-xl border border-ink/10 bg-white pl-10 pr-4 font-lv-display text-small text-ink outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

const SELECT =
  "h-[42px] w-full cursor-pointer appearance-none rounded-xl border border-ink/10 bg-white pl-3 pr-9 font-lv-display text-small text-ink outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

const PAGINACION =
  "inline-flex h-9 items-center rounded-full border border-ink/10 px-3 font-lv-display text-meta font-semibold text-ink transition-colors hover:border-verde-300 hover:bg-verde-50";

export function BusinessList({ datos }: { datos: DatosNegociosAdmin }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  const [texto, setTexto] = useState(datos.filtros.q);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [tipoLote, setTipoLote] = useState<TipoNegocio | "">("");
  const [procesando, setProcesando] = useState(false);

  const hayFiltros =
    datos.filtros.filtro !== "todos" ||
    Boolean(datos.filtros.q) ||
    Boolean(datos.filtros.categoria) ||
    Boolean(datos.filtros.plan) ||
    Boolean(datos.filtros.tipo) ||
    datos.filtros.estado !== "todos";

  const IDs_PAGINA = datos.filas.map((fila) => fila.id);
  const seleccionadosPagina = IDs_PAGINA.filter((id) =>
    seleccion.has(id),
  ).length;
  const todosPagina =
    IDs_PAGINA.length > 0 && seleccionadosPagina === IDs_PAGINA.length;

  const actualizar = useCallback(
    (cambios: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null || valor === "") params.delete(clave);
        else params.set(clave, valor);
      }
      params.delete("pagina");
      const consulta = params.toString();
      startTransition(() => {
        router.push(consulta ? `${pathname}?${consulta}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router, searchParams, startTransition],
  );

  const hrefCon = useCallback(
    (cambios: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null || valor === "") params.delete(clave);
        else params.set(clave, valor);
      }
      params.delete("pagina");
      const consulta = params.toString();
      return consulta ? `${pathname}?${consulta}` : pathname;
    },
    [pathname, searchParams],
  );

  const hrefPagina = useCallback(
    (pagina: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (pagina <= 1) params.delete("pagina");
      else params.set("pagina", String(pagina));
      const consulta = params.toString();
      return consulta ? `${pathname}?${consulta}` : pathname;
    },
    [pathname, searchParams],
  );

  useEffect(() => {
    setTexto(datos.filtros.q);
  }, [datos.filtros.q]);

  useEffect(() => {
    const limpio = texto.trim();
    if (limpio === datos.filtros.q) return;
    const temporizador = window.setTimeout(() => {
      actualizar({ q: limpio || null });
    }, 350);
    return () => window.clearTimeout(temporizador);
  }, [texto, datos.filtros.q, actualizar]);

  const claveVista = [
    datos.pagina,
    datos.filtros.filtro,
    datos.filtros.q,
    datos.filtros.categoria,
    datos.filtros.plan,
    datos.filtros.estado,
    datos.filtros.tipo,
    datos.filtros.orden,
    datos.filtros.dir,
  ].join("|");

  useEffect(() => {
    setSeleccion(new Set());
  }, [claveVista]);

  const alternarPagina = () => {
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (todosPagina) {
        for (const id of IDs_PAGINA) siguiente.delete(id);
      } else {
        for (const id of IDs_PAGINA) siguiente.add(id);
      }
      return siguiente;
    });
  };

  const alternarUno = (id: string) => {
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  };

  async function ejecutarLote(accion: "tipo" | "destacar", tipo?: TipoNegocio) {
    const ids = [...seleccion];
    if (ids.length === 0 || procesando) return;

    const cuantos = ids.length;
    const pregunta =
      accion === "tipo" && tipo
        ? `¿Asignar «${TIPO_NEGOCIO_LABEL[tipo]}» a ${cuantos} ${cuantos === 1 ? "negocio" : "negocios"}?`
        : `¿Destacar ${cuantos} ${cuantos === 1 ? "negocio" : "negocios"}?`;
    if (!window.confirm(pregunta)) return;

    setProcesando(true);
    try {
      const respuesta = await fetch("/api/admin/negocios/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion,
          ids,
          ...(tipo ? { tipo } : {}),
        }),
      });
      const resultado = (await respuesta.json().catch(() => null)) as {
        actualizados?: number;
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(resultado?.error ?? "No se pudo completar la acción.");
      }
      const actualizados = resultado?.actualizados ?? cuantos;
      toast.success(
        `Se actualizaron ${actualizados} ${actualizados === 1 ? "negocio" : "negocios"}.`,
      );
      setSeleccion(new Set());
      setTipoLote("");
      router.refresh();
    } catch (fallo) {
      toast.error(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo completar la acción.",
      );
    } finally {
      setProcesando(false);
    }
  }

  function asignarTipo() {
    if (!tipoLote) return;
    void ejecutarLote("tipo", tipoLote);
  }

  function enviarAviso() {
    const ids = [...seleccion];
    if (ids.length === 0) return;
    router.push(
      `/admin/notificaciones?negocios=${encodeURIComponent(ids.join(","))}`,
    );
  }

  async function alternarActivo(fila: NegocioAdminFila) {
    if (procesando) return;
    setProcesando(true);
    try {
      const respuesta = await fetch(`/api/places/${fila.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !fila.isActive }),
      });
      const resultado = (await respuesta.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(
          resultado?.error ?? "No se pudo cambiar la visibilidad.",
        );
      }
      toast.success(
        fila.isActive
          ? `«${fila.name}» ya no aparece en el mapa.`
          : `«${fila.name}» ahora aparece en el mapa.`,
      );
      router.refresh();
    } catch (fallo) {
      toast.error(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo cambiar la visibilidad.",
      );
    } finally {
      setProcesando(false);
    }
  }

  async function eliminar(fila: NegocioAdminFila) {
    if (procesando) return;
    if (!window.confirm(`¿Eliminar «${fila.name}» de La Verde?`)) return;
    setProcesando(true);
    try {
      const respuesta = await fetch(`/api/places/${fila.id}`, {
        method: "DELETE",
      });
      const resultado = (await respuesta.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(resultado?.error ?? "No se pudo eliminar el negocio.");
      }
      toast.success(`«${fila.name}» se eliminó de La Verde.`);
      router.refresh();
    } catch (fallo) {
      toast.error(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo eliminar el negocio.",
      );
    } finally {
      setProcesando(false);
    }
  }

  return (
    <>
      <div className="mb-gap-md flex items-center justify-between gap-gap-sm">
        <div className="min-w-0">
          <h1 className="sr-only">Negocios</h1>
          <p className="text-small text-ink-soft/75" aria-live="polite">
            {datos.total} {datos.total === 1 ? "negocio" : "negocios"}
            {hayFiltros ? ` de ${datos.conteos.todos}` : " en La Verde"}
          </p>
        </div>
        <Link
          href="/admin/negocios/nuevo"
          aria-label="Nuevo negocio"
          className="inline-flex h-11 shrink-0 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors hover:bg-verde-300 active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={1.8} aria-hidden />
          <span className="max-sm:hidden">Nuevo negocio</span>
        </Link>
      </div>

      <div className="mb-gap-sm flex flex-wrap gap-gap-xs">
        {CHIPS.map((chip) => {
          const activo = datos.filtros.filtro === chip.id;
          return (
            <Link
              key={chip.id}
              href={hrefCon({
                filtro: chip.id === "todos" ? null : chip.id,
              })}
              aria-current={activo ? "page" : undefined}
              className={clsx(
                "inline-flex min-h-9 items-center gap-gap-xs rounded-full border px-3 font-lv-display text-meta font-semibold transition-colors",
                activo
                  ? "border-verde-300 bg-verde-50 text-verde-800"
                  : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-200 hover:text-verde-700",
              )}
            >
              {chip.etiqueta}
              <span
                className={clsx(
                  "rounded-full px-[6px] py-[1px] text-[10px]",
                  activo ? "bg-verde-200/60" : "bg-sand",
                )}
              >
                {datos.conteos[chip.id]}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mb-gap-md flex flex-col gap-gap-sm lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-ink-soft/75"
            aria-hidden
          />
          <input
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              actualizar({ q: texto.trim() || null });
            }}
            placeholder="Buscar por nombre, dueño, barrio o categoría…"
            aria-label="Buscar negocios"
            className={INPUT}
          />
        </div>

        <div className="grid grid-cols-2 gap-gap-sm sm:grid-cols-4 lg:flex">
          <Selector
            etiqueta="Filtrar por categoría"
            valor={datos.filtros.categoria}
            onChange={(valor) => actualizar({ categoria: valor || null })}
          >
            <option value="">Todas las categorías</option>
            {datos.categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </Selector>

          <Selector
            etiqueta="Filtrar por plan"
            valor={datos.filtros.plan}
            onChange={(valor) => actualizar({ plan: valor || null })}
          >
            <option value="">Todos los planes</option>
            {datos.planes.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.nombre}
              </option>
            ))}
          </Selector>

          <Selector
            etiqueta="Filtrar por estado"
            valor={datos.filtros.estado}
            onChange={(valor) =>
              actualizar({ estado: valor === "todos" ? null : valor })
            }
          >
            <option value="todos">Todos los estados</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Cerrados / ocultos</option>
            <option value="destacados">Destacados</option>
          </Selector>

          <Selector
            etiqueta="Filtrar por tipo de negocio"
            valor={datos.filtros.tipo}
            onChange={(valor) => actualizar({ tipo: valor || null })}
          >
            <option value="">Todos los tipos</option>
            <option value="sin_tipo">⚠ Sin tipo asignado</option>
            {TIPOS_NEGOCIO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {TIPO_NEGOCIO_LABEL[tipo]}
              </option>
            ))}
          </Selector>
        </div>

        {hayFiltros ? (
          <BotonAdmin
            tamano="pequeno"
            onClick={() =>
              actualizar({
                filtro: null,
                q: null,
                categoria: null,
                plan: null,
                estado: null,
                tipo: null,
              })
            }
            className="shrink-0"
          >
            <X size={14} strokeWidth={1.8} aria-hidden />
            Limpiar filtros
          </BotonAdmin>
        ) : null}
      </div>

      {seleccion.size > 0 ? (
        <div className="sticky top-2 z-20 mb-gap-sm flex flex-wrap items-center gap-gap-xs rounded-2xl border border-verde-200 bg-white p-gap-sm shadow-lg">
          <span className="mr-auto whitespace-nowrap font-lv-display text-small font-semibold text-ink">
            {seleccion.size}{" "}
            {seleccion.size === 1 ? "seleccionado" : "seleccionados"}
          </span>
          <Selector
            etiqueta="Tipo para los negocios seleccionados"
            valor={tipoLote}
            onChange={(valor) => setTipoLote(valor as TipoNegocio | "")}
            className="w-[200px]"
          >
            <option value="">Asignar tipo…</option>
            {TIPOS_NEGOCIO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {TIPO_NEGOCIO_LABEL[tipo]}
              </option>
            ))}
          </Selector>
          <BotonAdmin
            tamano="pequeno"
            onClick={asignarTipo}
            disabled={!tipoLote || procesando}
          >
            Asignar
          </BotonAdmin>
          <BotonAdmin
            tamano="pequeno"
            onClick={() => void ejecutarLote("destacar")}
            disabled={procesando}
          >
            <Zap size={14} strokeWidth={1.8} aria-hidden />
            Destacar
          </BotonAdmin>
          <BotonAdmin tamano="pequeno" onClick={enviarAviso}>
            <Send size={14} strokeWidth={1.8} aria-hidden />
            Enviar aviso
          </BotonAdmin>
          <BotonAdmin
            tamano="pequeno"
            onClick={() => {
              setSeleccion(new Set());
              setTipoLote("");
            }}
          >
            Quitar selección
          </BotonAdmin>
          {procesando ? (
            <Loader2
              size={16}
              strokeWidth={1.8}
              className="animate-spin text-verde-600"
              aria-label="Procesando"
            />
          ) : null}
        </div>
      ) : null}

      {datos.filas.length === 0 ? (
        <div className="rounded-2xl border border-ink/5 bg-white">
          <EstadoVacioAdmin
            icono={MapPin}
            titulo="No hay negocios que coincidan"
            descripcion="Ajusta los filtros o crea un negocio nuevo."
            accion={
              hayFiltros ? (
                <BotonAdmin
                  onClick={() =>
                    actualizar({
                      filtro: null,
                      q: null,
                      categoria: null,
                      plan: null,
                      estado: null,
                      tipo: null,
                    })
                  }
                >
                  Limpiar filtros
                </BotonAdmin>
              ) : (
                <Link
                  href="/admin/negocios/nuevo"
                  className="inline-flex h-11 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo hover:bg-verde-300"
                >
                  <Plus size={16} strokeWidth={1.8} aria-hidden />
                  Nuevo negocio
                </Link>
              )
            }
          />
        </div>
      ) : (
        <>
          <div
            className={clsx(
              "hidden overflow-x-auto rounded-2xl border border-ink/5 bg-white lg:block",
              pendiente && "opacity-70",
            )}
            aria-busy={pendiente || procesando}
          >
            <table className="w-full min-w-[1080px] text-left">
              <thead className="border-b border-ink/5 bg-sand/50">
                <tr>
                  <th className="w-11 px-3 py-3">
                    <Casilla
                      checked={todosPagina}
                      indeterminate={seleccionadosPagina > 0 && !todosPagina}
                      onChange={alternarPagina}
                      label="Seleccionar todos los negocios de esta página"
                    />
                  </th>
                  <ThOrden
                    columna="nombre"
                    etiqueta="Negocio"
                    actual={datos.filtros.orden}
                    dir={datos.filtros.dir}
                    onOrdenar={(orden) =>
                      actualizar({
                        orden,
                        dir:
                          datos.filtros.orden === orden &&
                          datos.filtros.dir === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                  />
                  <ThOrden
                    columna="plan"
                    etiqueta="Plan"
                    actual={datos.filtros.orden}
                    dir={datos.filtros.dir}
                    onOrdenar={(orden) =>
                      actualizar({
                        orden,
                        dir:
                          datos.filtros.orden === orden &&
                          datos.filtros.dir === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                  />
                  <ThOrden
                    columna="pago"
                    etiqueta="Pago"
                    actual={datos.filtros.orden}
                    dir={datos.filtros.dir}
                    onOrdenar={(orden) =>
                      actualizar({
                        orden,
                        dir:
                          datos.filtros.orden === orden &&
                          datos.filtros.dir === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                  />
                  <ThOrden
                    columna="ficha"
                    etiqueta="Ficha"
                    actual={datos.filtros.orden}
                    dir={datos.filtros.dir}
                    onOrdenar={(orden) =>
                      actualizar({
                        orden,
                        dir:
                          datos.filtros.orden === orden &&
                          datos.filtros.dir === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                  />
                  <ThOrden
                    columna="actividad"
                    etiqueta="Actividad"
                    actual={datos.filtros.orden}
                    dir={datos.filtros.dir}
                    onOrdenar={(orden) =>
                      actualizar({
                        orden,
                        dir:
                          datos.filtros.orden === orden &&
                          datos.filtros.dir === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                  />
                  <ThOrden
                    columna="visitas"
                    etiqueta="Visitas"
                    actual={datos.filtros.orden}
                    dir={datos.filtros.dir}
                    onOrdenar={(orden) =>
                      actualizar({
                        orden,
                        dir:
                          datos.filtros.orden === orden &&
                          datos.filtros.dir === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                  />
                  <ThOrden
                    columna="estado"
                    etiqueta="Estado"
                    actual={datos.filtros.orden}
                    dir={datos.filtros.dir}
                    onOrdenar={(orden) =>
                      actualizar({
                        orden,
                        dir:
                          datos.filtros.orden === orden &&
                          datos.filtros.dir === "asc"
                            ? "desc"
                            : "asc",
                      })
                    }
                  />
                  <th className="px-3 py-3 text-right font-lv-display text-meta font-semibold text-ink-soft/60">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {datos.filas.map((fila) => (
                  <FilaNegocio
                    key={fila.id}
                    fila={fila}
                    seleccionada={seleccion.has(fila.id)}
                    onSeleccion={() => alternarUno(fila.id)}
                    onActivo={() => void alternarActivo(fila)}
                    onEliminar={() => void eliminar(fila)}
                    disabled={procesando}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-gap-sm lg:hidden">
            {datos.filas.map((fila) => (
              <TarjetaNegocio
                key={fila.id}
                fila={fila}
                seleccionada={seleccion.has(fila.id)}
                onSeleccion={() => alternarUno(fila.id)}
                onActivo={() => void alternarActivo(fila)}
                onEliminar={() => void eliminar(fila)}
                disabled={procesando}
              />
            ))}
          </div>

          <nav
            className="mt-gap-sm flex flex-wrap items-center justify-between gap-gap-sm"
            aria-label="Paginación de negocios"
          >
            <p className="text-meta text-ink-soft/70">
              Mostrando{" "}
              {datos.total === 0 ? 0 : (datos.pagina - 1) * datos.porPagina + 1}
              –{Math.min(datos.total, datos.pagina * datos.porPagina)} de{" "}
              {datos.total}
            </p>
            <div className="flex items-center gap-gap-xs">
              {datos.pagina > 1 ? (
                <Link
                  href={hrefPagina(datos.pagina - 1)}
                  className={PAGINACION}
                >
                  Anterior
                </Link>
              ) : (
                <span className={clsx(PAGINACION, "opacity-40")}>Anterior</span>
              )}
              <span className="px-gap-xs font-lv-display text-meta font-semibold text-ink">
                Página {datos.pagina} de {datos.paginas}
              </span>
              {datos.pagina < datos.paginas ? (
                <Link
                  href={hrefPagina(datos.pagina + 1)}
                  className={PAGINACION}
                >
                  Siguiente
                </Link>
              ) : (
                <span className={clsx(PAGINACION, "opacity-40")}>
                  Siguiente
                </span>
              )}
            </div>
          </nav>
        </>
      )}
    </>
  );
}

function Selector({
  etiqueta,
  valor,
  onChange,
  children,
  className,
}: {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("relative min-w-0", className ?? "w-full")}>
      <select
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        aria-label={etiqueta}
        className={SELECT}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        strokeWidth={1.8}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
        aria-hidden
      />
    </div>
  );
}

function Casilla({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="size-4 cursor-pointer accent-verde-600"
    />
  );
}

function ThOrden({
  columna,
  etiqueta,
  actual,
  dir,
  onOrdenar,
}: {
  columna: OrdenNegocios;
  etiqueta: string;
  actual: OrdenNegocios;
  dir: "asc" | "desc";
  onOrdenar: (orden: OrdenNegocios) => void;
}) {
  const activa = actual === columna;
  const Icono = activa ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      aria-sort={activa ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className="px-3 py-3"
    >
      <button
        type="button"
        onClick={() => onOrdenar(columna)}
        className={clsx(
          "inline-flex cursor-pointer items-center gap-[4px] font-lv-display text-meta font-semibold transition-colors hover:text-verde-700",
          activa ? "text-verde-800" : "text-ink-soft/60",
        )}
      >
        {etiqueta}
        <Icono size={12} strokeWidth={1.8} aria-hidden />
      </button>
    </th>
  );
}

function FilaNegocio({
  fila,
  seleccionada,
  onSeleccion,
  onActivo,
  onEliminar,
  disabled,
}: {
  fila: NegocioAdminFila;
  seleccionada: boolean;
  onSeleccion: () => void;
  onActivo: () => void;
  onEliminar: () => void;
  disabled: boolean;
}) {
  return (
    <tr
      className={clsx(
        "align-top transition-colors",
        seleccionada ? "bg-verde-50/50" : "hover:bg-sand/35",
      )}
    >
      <td className="px-3 py-3">
        <Casilla
          checked={seleccionada}
          onChange={onSeleccion}
          label={`Seleccionar ${fila.name}`}
        />
      </td>
      <td className="max-w-[260px] px-3 py-3">
        <div className="flex items-center gap-gap-xs">
          <EnlaceNegocio
            id={fila.id}
            title={`Abrir la ficha de ${fila.name}`}
            className="min-w-0 truncate font-lv-display text-small font-semibold text-ink transition-colors hover:text-verde-700"
          >
            {fila.name}
          </EnlaceNegocio>
          {fila.isBoosted ? (
            <Zap
              size={12}
              strokeWidth={2}
              className="shrink-0 text-verde-600"
              aria-label="Destacado"
            />
          ) : null}
        </div>
        <p className="mt-[2px] truncate text-meta text-ink-soft/65">
          {fila.tipoLabel} · {fila.ubicacion}
        </p>
      </td>
      <td className="px-3 py-3">
        <PlanCelda plan={fila.plan} />
      </td>
      <td className="px-3 py-3">
        <PagoCelda pago={fila.pago} />
      </td>
      <td className="px-3 py-3">
        <FichaCelda ficha={fila.ficha} />
      </td>
      <td className="px-3 py-3">
        <ActividadCelda
          fecha={fila.ultimaActividad}
          dias={fila.diasSinActividad}
        />
      </td>
      <td className="px-3 py-3 font-lv-display text-small font-semibold text-ink">
        {fila.visitas30.toLocaleString("es-CU")}
      </td>
      <td className="px-3 py-3">
        <EstadoCelda estado={fila.estado} />
      </td>
      <td className="px-3 py-3">
        <AccionesFila
          fila={fila}
          onActivo={onActivo}
          onEliminar={onEliminar}
          disabled={disabled}
        />
      </td>
    </tr>
  );
}

function TarjetaNegocio({
  fila,
  seleccionada,
  onSeleccion,
  onActivo,
  onEliminar,
  disabled,
}: {
  fila: NegocioAdminFila;
  seleccionada: boolean;
  onSeleccion: () => void;
  onActivo: () => void;
  onEliminar: () => void;
  disabled: boolean;
}) {
  return (
    <article
      className={clsx(
        "rounded-2xl border bg-white p-gap-sm",
        seleccionada ? "border-verde-300 bg-verde-50/30" : "border-ink/5",
      )}
    >
      <div className="flex items-start gap-gap-sm">
        <div className="pt-[2px]">
          <Casilla
            checked={seleccionada}
            onChange={onSeleccion}
            label={`Seleccionar ${fila.name}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-gap-xs">
            <EnlaceNegocio
              id={fila.id}
              className="min-w-0 truncate font-lv-display text-small font-semibold text-ink"
            >
              {fila.name}
            </EnlaceNegocio>
            {fila.isBoosted ? (
              <Zap
                size={12}
                strokeWidth={2}
                className="shrink-0 text-verde-600"
                aria-label="Destacado"
              />
            ) : null}
          </div>
          <p className="truncate text-meta text-ink-soft/65">
            {fila.tipoLabel} · {fila.ubicacion}
          </p>
        </div>
        <EstadoCelda estado={fila.estado} />
      </div>

      <div className="mt-gap-sm grid grid-cols-2 gap-gap-xs border-t border-ink/5 pt-gap-sm">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-soft/50">
            Plan
          </p>
          <PlanCelda plan={fila.plan} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-soft/50">
            Pago
          </p>
          <PagoCelda pago={fila.pago} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-soft/50">
            Ficha
          </p>
          <FichaCelda ficha={fila.ficha} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-soft/50">
            Última actividad
          </p>
          <ActividadCelda
            fecha={fila.ultimaActividad}
            dias={fila.diasSinActividad}
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-ink-soft/50">
            Visitas 30 días
          </p>
          <p className="font-lv-display text-small font-semibold text-ink">
            {fila.visitas30.toLocaleString("es-CU")}
          </p>
        </div>
        <div className="flex items-end justify-end">
          <AccionesFila
            fila={fila}
            onActivo={onActivo}
            onEliminar={onEliminar}
            disabled={disabled}
          />
        </div>
      </div>
    </article>
  );
}

function PlanCelda({ plan }: { plan: NegocioAdminFila["plan"] }) {
  return (
    <div className="flex flex-wrap items-center gap-gap-xs">
      <ChapitaEstado
        tono={plan.efectivo === "gratis" ? "neutra" : "ok"}
        punto={false}
      >
        {plan.nombre}
      </ChapitaEstado>
      {plan.efectivo !== plan.contratado ? (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft/50">
          Prueba
        </span>
      ) : null}
    </div>
  );
}

function PagoCelda({ pago }: { pago: NegocioAdminFila["pago"] }) {
  return (
    <div>
      <ChapitaEstado tono={TONO_PAGO[pago.estado]} punto={false}>
        {pago.etiqueta}
      </ChapitaEstado>
      <p className="mt-1 max-w-[180px] text-[10px] leading-snug text-ink-soft/60">
        {pago.detalle}
      </p>
    </div>
  );
}

function FichaCelda({ ficha }: { ficha: NegocioAdminFila["ficha"] }) {
  return (
    <div className="w-24">
      <div className="flex items-center justify-between gap-gap-xs">
        <BarraProgreso pct={ficha.pct} etiqueta="Completitud de la ficha" />
        <span className="shrink-0 font-lv-display text-[10px] font-semibold text-ink-soft/70">
          {ficha.pct}%
        </span>
      </div>
      {ficha.faltan.length > 0 ? (
        <p
          className="mt-1 truncate text-[10px] text-ink-soft/55"
          title={ficha.faltan.join(" · ")}
        >
          {ficha.faltan[0]}
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-verde-700">Completa</p>
      )}
    </div>
  );
}

function ActividadCelda({
  fecha,
  dias,
}: {
  fecha: string | null;
  dias: number;
}) {
  return (
    <div>
      <p
        className={clsx(
          "font-lv-display text-meta font-semibold",
          dias > 30 ? "text-destructive-ink" : "text-ink",
        )}
      >
        {fecha ?? "Sin registro"}
      </p>
      <p
        className={clsx(
          "text-[10px]",
          dias > 30 ? "text-destructive-ink/75" : "text-ink-soft/55",
        )}
      >
        {dias === 0 ? "Hoy" : `Hace ${dias} ${dias === 1 ? "día" : "días"}`}
      </p>
    </div>
  );
}

function EstadoCelda({ estado }: { estado: EstadoPublicacionNegocio }) {
  return (
    <ChapitaEstado tono={TONO_ESTADO[estado]} punto={false}>
      {ETIQUETA_ESTADO[estado]}
    </ChapitaEstado>
  );
}

function AccionesFila({
  fila,
  onActivo,
  onEliminar,
  disabled,
}: {
  fila: NegocioAdminFila;
  onActivo: () => void;
  onEliminar: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-[2px]">
      <BotonIconoAdmin
        onClick={onActivo}
        disabled={disabled}
        aria-label={
          fila.isActive
            ? `Ocultar «${fila.name}» del mapa`
            : `Mostrar «${fila.name}» en el mapa`
        }
        title={fila.isActive ? "Visible en el mapa" : "Oculto del mapa"}
      >
        {fila.isActive ? (
          <Eye size={16} strokeWidth={1.8} />
        ) : (
          <EyeOff size={16} strokeWidth={1.8} />
        )}
      </BotonIconoAdmin>
      <Link
        href={`/admin/negocios/${fila.id}/editar`}
        aria-label={`Editar ${fila.name}`}
        title="Editar"
        className="grid size-11 shrink-0 place-items-center rounded-full text-ink-soft/75 transition-colors hover:bg-verde-50 hover:text-verde-600"
      >
        <Pencil size={16} strokeWidth={1.8} />
      </Link>
      <BotonIconoAdmin
        onClick={onEliminar}
        disabled={disabled}
        aria-label={`Eliminar ${fila.name}`}
        title="Eliminar"
        className="hover:bg-destructive/5 hover:text-destructive-ink"
      >
        <Trash2 size={16} strokeWidth={1.8} />
      </BotonIconoAdmin>
    </div>
  );
}

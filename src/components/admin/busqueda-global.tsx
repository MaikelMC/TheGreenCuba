"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  CornerDownLeft,
  LayoutGrid,
  Loader2,
  Search,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ResultadoBusquedaAdmin,
  ResultadosBusquedaAdmin,
} from "@/lib/admin-busqueda";

/**
 * El buscador global del panel.
 *
 * Escritorio: botón en la barra superior y atajo `Ctrl/Cmd + K`. Móvil: la lupa
 * abre el mismo diálogo a pantalla completa, con «Cancelar» a la derecha.
 *
 * La consulta se espera 220 ms antes de salir al servidor y cada tecla cancela
 * la petición anterior: escribir «la habana» no dispara diez búsquedas. Los
 * resultados se navegan con las flechas y se abren con Enter.
 *
 * Las secciones se buscan en el servidor junto con negocios y usuarios, para
 * que un resultado no dependa de que la sección esté en el cliente.
 */

type RespuestaBusqueda = Partial<ResultadosBusquedaAdmin> & {
  error?: string;
};

const ICONO = {
  negocio: Store,
  usuario: UserRound,
  seccion: LayoutGrid,
} as const;

const VACIO: ResultadosBusquedaAdmin = {
  negocios: [],
  usuarios: [],
  secciones: [],
};

export function BuscadorGlobal() {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadosBusquedaAdmin | null>(
    null,
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const planos = resultados
    ? [...resultados.negocios, ...resultados.usuarios, ...resultados.secciones]
    : [];

  /* El atajo funciona en toda la sección, no solo con el foco en el buscador. */
  useEffect(() => {
    function alTeclear(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAbierto((estaba) => !estaba);
      }
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  /* Al cerrar se limpia todo: la próxima apertura empieza en blanco. */
  useEffect(() => {
    if (abierto) return;
    setTexto("");
    setResultados(null);
    setCargando(false);
    setError(null);
    setSeleccion(0);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;

    const consulta = texto.trim();
    if (!consulta) {
      setResultados(null);
      setCargando(false);
      setError(null);
      return;
    }

    const control = new AbortController();
    const espera = setTimeout(async () => {
      setCargando(true);
      setError(null);

      try {
        const respuesta = await fetch(
          `/api/admin/buscar?q=${encodeURIComponent(consulta)}`,
          { signal: control.signal },
        );
        const datos = (await respuesta
          .json()
          .catch(() => null)) as RespuestaBusqueda | null;

        if (!respuesta.ok) {
          throw new Error(datos?.error ?? "No se pudo completar la búsqueda.");
        }

        setResultados({
          negocios: datos?.negocios ?? [],
          usuarios: datos?.usuarios ?? [],
          secciones: datos?.secciones ?? [],
        });
        setSeleccion(0);
      } catch (fallo) {
        if (control.signal.aborted) return;
        setError(
          fallo instanceof Error
            ? fallo.message
            : "No se pudo completar la búsqueda.",
        );
        setResultados(VACIO);
      } finally {
        if (!control.signal.aborted) setCargando(false);
      }
    }, 220);

    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [abierto, texto]);

  /* Mantiene visible la opción que se mueve con las flechas. */
  useEffect(() => {
    if (!abierto) return;
    document
      .getElementById(`busqueda-opcion-${seleccion}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [abierto, seleccion]);

  function elegir(resultado: ResultadoBusquedaAdmin) {
    setAbierto(false);
    router.push(resultado.href);
  }

  function alPulsarTecla(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (planos.length === 0) return;
      setSeleccion((actual) => Math.min(actual + 1, planos.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (planos.length === 0) return;
      setSeleccion((actual) => Math.max(actual - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      const elegido = planos[seleccion];
      if (!elegido) return;
      event.preventDefault();
      elegir(elegido);
    }
  }

  const idActivo =
    planos.length > 0 ? `busqueda-opcion-${seleccion}` : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Buscar en el panel"
        aria-keyshortcuts="Control+K Meta+K"
        className="grid size-11 shrink-0 place-items-center rounded-full text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-verde-50 hover:text-verde-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40 sm:hidden"
      >
        <Search size={20} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Buscar en el panel"
        aria-keyshortcuts="Control+K Meta+K"
        className="hidden h-10 shrink-0 cursor-pointer items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-small font-medium text-ink-soft/75 transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40 sm:inline-flex"
      >
        <Search size={17} strokeWidth={1.8} />
        <span>Buscar</span>
        <kbd className="ml-gap-xs rounded border border-ink/10 bg-sand px-[5px] py-[1px] font-lv-display text-[10px] font-semibold text-ink-soft/60">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent
          hideClose
          className="panel-portal flex flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Buscar en el panel</DialogTitle>
          <DialogDescription className="sr-only">
            Busca negocios por nombre, dueño, teléfono o ciudad; personas por
            nombre, correo o teléfono; y secciones del panel.
          </DialogDescription>

          <div className="flex shrink-0 items-center gap-gap-sm border-b border-ink/5 px-gap-sm py-gap-sm sm:px-gap-md">
            <Search
              size={20}
              strokeWidth={1.8}
              className="shrink-0 text-ink-soft/60"
              aria-hidden
            />
            <input
              ref={inputRef}
              autoFocus
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              onKeyDown={alPulsarTecla}
              placeholder="Negocios, personas o secciones…"
              aria-label="Buscar en el panel"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={planos.length > 0}
              aria-controls="resultados-busqueda"
              aria-activedescendant={idActivo}
              className="h-11 min-w-0 flex-1 bg-transparent font-lv-display text-body text-ink outline-none placeholder:text-ink-soft/55"
            />
            {cargando && (
              <Loader2
                size={18}
                strokeWidth={1.8}
                className="shrink-0 animate-spin text-verde-600"
                aria-label="Buscando"
              />
            )}
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="inline-flex min-h-11 shrink-0 items-center px-gap-xs font-lv-display text-small font-semibold text-verde-700 sm:hidden"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar buscador"
              className="hidden size-11 shrink-0 place-items-center rounded-full text-ink-soft/60 transition-colors hover:bg-sand hover:text-ink sm:grid"
            >
              <X size={19} strokeWidth={1.8} />
            </button>
          </div>

          <div
            id="resultados-busqueda"
            role="listbox"
            aria-label="Resultados de la búsqueda"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gap-xs py-gap-sm sm:px-gap-sm"
          >
            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-destructive/20 bg-destructive/5 px-gap-sm py-gap-sm text-small text-destructive-ink"
              >
                {error}
              </p>
            ) : !texto.trim() ? (
              <div className="px-gap-sm py-gap-xl text-center">
                <p className="font-lv-display text-small font-semibold text-ink">
                  Busca cualquier cosa del panel
                </p>
                <p className="mx-auto mt-gap-xs max-w-[42ch] text-meta text-ink-soft/70">
                  Un negocio por nombre, dueño, teléfono o ciudad; una persona
                  por correo; o una sección. También con{" "}
                  <kbd className="rounded border border-ink/10 bg-sand px-[4px] py-[1px] text-[10px] font-semibold">
                    Ctrl K
                  </kbd>
                  .
                </p>
              </div>
            ) : planos.length === 0 && !cargando ? (
              <p className="px-gap-sm py-gap-xl text-center text-small text-ink-soft/70">
                No encontramos nada para «{texto.trim()}».
              </p>
            ) : (
              <>
                <Grupo
                  titulo="Negocios"
                  resultados={resultados?.negocios ?? []}
                  desde={0}
                  seleccion={seleccion}
                  alSeleccionar={setSeleccion}
                  alElegir={elegir}
                />
                <Grupo
                  titulo="Personas"
                  resultados={resultados?.usuarios ?? []}
                  desde={resultados?.negocios.length ?? 0}
                  seleccion={seleccion}
                  alSeleccionar={setSeleccion}
                  alElegir={elegir}
                />
                <Grupo
                  titulo="Secciones"
                  resultados={resultados?.secciones ?? []}
                  desde={
                    (resultados?.negocios.length ?? 0) +
                    (resultados?.usuarios.length ?? 0)
                  }
                  seleccion={seleccion}
                  alSeleccionar={setSeleccion}
                  alElegir={elegir}
                />
              </>
            )}
          </div>

          <div className="hidden shrink-0 items-center gap-gap-md border-t border-ink/5 px-gap-md py-2 text-meta text-ink-soft/55 sm:flex">
            <span className="inline-flex items-center gap-1">
              <Tecla>↑</Tecla>
              <Tecla>↓</Tecla> moverte
            </span>
            <span className="inline-flex items-center gap-1">
              <Tecla>Enter</Tecla> abrir
            </span>
            <span className="inline-flex items-center gap-1">
              <Tecla>Esc</Tecla> cerrar
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Grupo({
  titulo,
  resultados,
  desde,
  seleccion,
  alSeleccionar,
  alElegir,
}: {
  titulo: string;
  resultados: ResultadoBusquedaAdmin[];
  desde: number;
  seleccion: number;
  alSeleccionar: (indice: number) => void;
  alElegir: (resultado: ResultadoBusquedaAdmin) => void;
}) {
  if (resultados.length === 0) return null;

  return (
    <div className="mb-gap-xs">
      <p className="px-gap-sm pb-[4px] pt-gap-xs font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft/45">
        {titulo}
      </p>
      {resultados.map((resultado, posicion) => {
        const indice = desde + posicion;
        const Icono = ICONO[resultado.tipo];
        const activo = indice === seleccion;

        return (
          <button
            key={resultado.clave}
            type="button"
            role="option"
            id={`busqueda-opcion-${indice}`}
            aria-selected={activo}
            onMouseEnter={() => alSeleccionar(indice)}
            onClick={() => alElegir(resultado)}
            className={clsx(
              "flex w-full cursor-pointer items-center gap-gap-sm rounded-xl px-gap-sm py-2.5 text-left transition-colors duration-200",
              activo ? "bg-verde-50" : "hover:bg-sand",
            )}
          >
            <span
              className={clsx(
                "grid size-9 shrink-0 place-items-center rounded-full",
                activo
                  ? "bg-verde-100 text-verde-700"
                  : "bg-sand text-ink-soft/70",
              )}
            >
              <Icono size={17} strokeWidth={1.8} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-lv-display text-small font-semibold text-ink">
                {resultado.titulo}
              </span>
              <span className="block truncate text-meta text-ink-soft/70">
                {resultado.detalle}
              </span>
            </span>
            <CornerDownLeft
              size={15}
              strokeWidth={1.8}
              className={clsx(
                "shrink-0 text-ink-soft/45",
                activo ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-ink/10 bg-sand px-[4px] py-[1px] font-lv-display text-[10px] font-semibold text-ink-soft/65">
      {children}
    </kbd>
  );
}

"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Trash2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAX_BYTES,
  MONEDAS,
  PLANTILLA_CSV,
  resumir,
  validarFilas,
  type FilaCruda,
  type FilaValidada,
  type ProductoExistente,
  type Resumen,
} from "@/lib/importar-catalogo";

const INPUT =
  "px-gap-sm border border-ink/10 rounded-xl font-lv text-small bg-white text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

const BOTON =
  "inline-flex items-center justify-center gap-gap-xs h-11 px-gap-lg rounded-full font-lv-display text-small font-semibold transition-all duration-500 ease-outquint active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

const ESTADO_CLASE: Record<FilaValidada["estado"], string> = {
  nuevo: "bg-verde-50 text-verde-600",
  duplicado: "bg-sand-deep text-ink-soft/75",
  error: "bg-destructive/10 text-destructive",
};

const RESUMEN_VACIO: Resumen = { nuevos: 0, duplicados: 0, errores: 0 };

interface ImportarCatalogoProps {
  placeId: string;
  /** La carta que ya tiene el negocio, para detectar duplicados en vivo. */
  existentes: ProductoExistente[];
  /**
   * A dónde lleva «volver» tras importar o deshacer.
   *
   * En administración es la lista de negocios; en el panel del negocio no hay
   * a dónde ir —el catálogo es una sección, no una ruta—, así que ahí se pasa
   * `onVolver` y el botón cierra el importador en vez de navegar.
   */
  volverHref?: string;
  onVolver?: () => void;
  /**
   * La carta cambió **en la base**: alguien importó o deshizo la importación.
   *
   * Existe porque las dos operaciones escriben en el servidor mientras la
   * pantalla que abre el importador sigue con su propia copia de la carta en
   * memoria. Sin volver a leerla, el próximo guardado manda esa copia vieja y
   * borra lo que se acababa de importar —o resucita lo que se acababa de
   * deshacer—. Se avisa en la operación y no al «volver», porque entre una cosa
   * y la otra la pantalla puede guardar.
   */
  onCartaCambiada?: () => void;
}

/**
 * Importación de catálogo por CSV: vista previa editable y confirmación.
 *
 * El parseo y la validación los hace el servidor la primera vez —así el archivo
 * mal formado se rechaza entero, con su motivo—, pero **corregir una fila no
 * vuelve al servidor**: se revalida con la misma función pura que usa la ruta,
 * importada de `@/lib/importar-catalogo`. Es lo que deja editar en línea sin un
 * viaje por tecla y sin que la lógica se duplique en dos sitios.
 */
export function ImportarCatalogo({
  placeId,
  existentes,
  volverHref = "/admin/negocios",
  onVolver,
  onCartaCambiada,
}: ImportarCatalogoProps) {
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState<FilaValidada[] | null>(null);
  const [resumen, setResumen] = useState<Resumen>(RESUMEN_VACIO);
  const [actuales, setActuales] = useState(existentes.length);
  const [tope, setTope] = useState<number | null>(null);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [categoriaAsignar, setCategoriaAsignar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importados, setImportados] = useState<number | null>(null);
  const [importacionId, setImportacionId] = useState<string | null>(null);
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [deshecho, setDeshecho] = useState<number | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  /** Revalida una lista editada con la misma función que usa el servidor. */
  const revalidar = useCallback(
    (next: FilaCruda[]) => {
      const validadas = validarFilas(next, existentes);
      setFilas(validadas);
      setResumen(resumir(validadas));
    },
    [existentes],
  );

  const descargarPlantilla = useCallback(() => {
    /* Con BOM delante: es lo que hace que Excel lo abra en UTF-8 y no destroce
       las tildes. El parser lo tolera, así que reimportar la plantilla va fina. */
    const blob = new Blob(["\uFEFF" + PLANTILLA_CSV], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-catalogo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const leerArchivo = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("El archivo pasa de 1 MB. Divídelo en varios.");
      return;
    }
    setTexto(await file.text());
  }, []);

  const analizar = useCallback(async () => {
    setError(null);
    setCargando(true);
    setFilas(null);
    try {
      const res = await fetch(`/api/places/${placeId}/importar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            filas?: FilaValidada[];
            resumen?: Resumen;
            actuales?: number;
            tope?: number | null;
          }
        | null;
      if (!res.ok || !data?.filas) {
        throw new Error(data?.error ?? "No se pudo analizar el archivo.");
      }
      setFilas(data.filas);
      setResumen(data.resumen ?? RESUMEN_VACIO);
      setActuales(data.actuales ?? existentes.length);
      setTope(data.tope ?? null);
      setSeleccion(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar el archivo.");
    } finally {
      setCargando(false);
    }
  }, [placeId, texto, existentes.length]);

  const editar = useCallback(
    (numero: number, campo: keyof FilaCruda, valor: string) => {
      if (!filas) return;
      revalidar(filas.map((f) => (f.numero === numero ? { ...f, [campo]: valor } : f)));
    },
    [filas, revalidar],
  );

  const eliminarFila = useCallback(
    (numero: number) => {
      if (!filas) return;
      revalidar(filas.filter((f) => f.numero !== numero));
      setSeleccion((s) => {
        const next = new Set(s);
        next.delete(numero);
        return next;
      });
    },
    [filas, revalidar],
  );

  const toggle = useCallback((numero: number) => {
    setSeleccion((s) => {
      const next = new Set(s);
      if (next.has(numero)) next.delete(numero);
      else next.add(numero);
      return next;
    });
  }, []);

  const asignarCategoria = useCallback(() => {
    if (!filas || !categoriaAsignar.trim() || seleccion.size === 0) return;
    const valor = categoriaAsignar.trim();
    revalidar(
      filas.map((f) => (seleccion.has(f.numero) ? { ...f, categoria: valor } : f)),
    );
  }, [filas, categoriaAsignar, seleccion, revalidar]);

  const confirmar = useCallback(async () => {
    if (!filas) return;
    setError(null);
    setImportando(true);
    try {
      const res = await fetch(`/api/places/${placeId}/importar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "confirmar", filas }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            importacionId?: string;
            importados?: number;
            filas?: FilaValidada[];
            resumen?: Resumen;
          }
        | null;
      if (!res.ok) {
        /* Si el servidor devuelve filas revalidadas —un error que se coló—, se
           pintan; si no, queda el mensaje, que es el caso del tope del plan. */
        if (data?.filas) {
          setFilas(data.filas);
          setResumen(data.resumen ?? RESUMEN_VACIO);
        }
        throw new Error(data?.error ?? "No se pudo importar.");
      }
      setImportados(data?.importados ?? 0);
      setImportacionId(data?.importacionId ?? null);
      setFilas(null);
      setSeleccion(new Set());
      /* Después de escribir, para que quien abrió el importador relea la carta
         antes de que le dé tiempo a guardar su copia vieja encima. */
      onCartaCambiada?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar.");
    } finally {
      setImportando(false);
    }
  }, [filas, placeId, onCartaCambiada]);

  const deshacer = useCallback(async () => {
    if (!importacionId) return;
    setError(null);
    setDeshaciendo(true);
    try {
      const res = await fetch(
        `/api/places/${placeId}/importar?importacionId=${encodeURIComponent(importacionId)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => null)) as
        | { error?: string; eliminados?: number }
        | null;
      if (!res.ok) throw new Error(data?.error ?? "No se pudo deshacer.");
      setDeshecho(data?.eliminados ?? 0);
      setImportados(null);
      setImportacionId(null);
      /* Deshacer también escribe en la base: sin releer, la pantalla se queda
         con los productos que acaban de borrarse y el siguiente guardado los
         devuelve. */
      onCartaCambiada?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo deshacer.");
    } finally {
      setDeshaciendo(false);
    }
  }, [importacionId, placeId, onCartaCambiada]);

  const superaTope = tope !== null && actuales + resumen.nuevos > tope;
  const puedeConfirmar =
    filas !== null &&
    resumen.errores === 0 &&
    resumen.nuevos > 0 &&
    !superaTope &&
    !importando;

  /* ── Ya importado ─────────────────────────────────────────────────────── */
  if (importados !== null) {
    return (
      <section className="rounded-2xl border border-verde-200 bg-verde-50/60 p-gap-lg flex flex-col gap-gap-md">
        <div className="flex items-start gap-gap-sm">
          <CheckCircle2 size={22} strokeWidth={1.8} className="text-verde-600 shrink-0 mt-[2px]" />
          <div>
            <h2 className="font-lv-display text-title text-ink">
              Importación hecha
            </h2>
            <p className="text-meta text-ink-soft/75 mt-gap-xs">
              Se añadieron {importados} producto{importados === 1 ? "" : "s"} a la
              carta. Ya se ven en el menú público del negocio.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-gap-sm">
          <button
            type="button"
            onClick={() => void deshacer()}
            disabled={deshaciendo}
            className={cn(BOTON, "bg-white border border-destructive/25 text-destructive hover:bg-destructive/10")}
          >
            {deshaciendo ? (
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Undo2 size={16} strokeWidth={1.8} />
            )}
            Deshacer importación
          </button>
          <Volver
            href={volverHref}
            onVolver={onVolver}
            className={cn(BOTON, "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300")}
          />
        </div>
        {error && <Aviso>{error}</Aviso>}
      </section>
    );
  }

  /* ── Deshecho ─────────────────────────────────────────────────────────── */
  if (deshecho !== null) {
    return (
      <section className="rounded-2xl border border-ink/10 bg-white p-gap-lg flex flex-col gap-gap-md">
        <p className="text-small text-ink">
          Importación deshecha: se quitaron {deshecho} producto
          {deshecho === 1 ? "" : "s"} de la carta.
        </p>
        <div className="flex flex-wrap gap-gap-sm">
          <button
            type="button"
            onClick={() => {
              setDeshecho(null);
              setTexto("");
            }}
            className={cn(BOTON, "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300")}
          >
            Importar otro catálogo
          </button>
          <Volver
            href={volverHref}
            onVolver={onVolver}
            className={cn(BOTON, "bg-white border border-ink/10 text-ink hover:border-verde-300")}
          />
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-gap-lg">
      {/* ── Entrada ─────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-ink/10 bg-white p-gap-lg flex flex-col gap-gap-md">
        <div className="flex flex-wrap items-center justify-between gap-gap-sm">
          <p className="text-meta text-ink-soft/75">
            Columnas: <code>nombre</code>, <code>categoria</code>,{" "}
            <code>descripcion</code>, <code>precio</code>, <code>moneda</code>.
            Hasta 500 filas y 1 MB.
          </p>
          <button
            type="button"
            onClick={descargarPlantilla}
            className={cn(BOTON, "bg-white border border-ink/10 text-ink hover:border-verde-300 hover:text-verde-600")}
          >
            <Download size={16} strokeWidth={1.8} />
            Descargar plantilla
          </button>
        </div>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={"nombre,categoria,descripcion,precio,moneda\nRopa vieja,Entrantes,Con sofrito,850,CUP"}
          className={cn(INPUT, "w-full py-gap-sm font-mono text-meta leading-relaxed resize-y")}
        />

        <div className="flex flex-wrap items-center gap-gap-sm">
          <input
            ref={archivoRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void leerArchivo(file);
            }}
          />
          <button
            type="button"
            onClick={() => archivoRef.current?.click()}
            className={cn(BOTON, "bg-white border border-ink/10 text-ink hover:border-verde-300 hover:text-verde-600")}
          >
            <FileUp size={16} strokeWidth={1.8} />
            Subir .csv
          </button>
          <button
            type="button"
            onClick={() => void analizar()}
            disabled={cargando || !texto.trim()}
            className={cn(BOTON, "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300")}
          >
            {cargando && <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />}
            Analizar
          </button>
        </div>

        {error && <Aviso>{error}</Aviso>}
      </section>

      {/* ── Vista previa ────────────────────────────────────────────────── */}
      {filas && (
        <section className="rounded-2xl border border-ink/10 bg-white p-gap-lg flex flex-col gap-gap-md">
          <div className="flex flex-wrap items-center gap-gap-sm">
            <Chip tono="verde">{resumen.nuevos} nuevos</Chip>
            <Chip tono="arena">{resumen.duplicados} duplicados</Chip>
            <Chip tono={resumen.errores > 0 ? "rojo" : "neutro"}>
              {resumen.errores} errores
            </Chip>
            <span className="text-meta text-ink-soft/75">
              {actuales} productos en la carta
              {tope !== null ? ` · el plan permite ${tope}` : " · sin tope de plan"}
            </span>
          </div>

          {superaTope && (
            <Aviso>
              Con estos {resumen.nuevos} productos nuevos, la carta pasaría de{" "}
              {tope} —el tope de tu plan— y no se puede importar. Quita filas
              hasta bajar de {Math.max(0, tope! - actuales)} productos nuevos, o
              sube el plan del negocio. Hasta entonces no se importa nada.
            </Aviso>
          )}

          {seleccion.size > 0 && (
            <div className="flex flex-wrap items-center gap-gap-sm rounded-xl bg-sand-deep/60 p-gap-sm">
              <span className="text-meta text-ink-soft/75">
                {seleccion.size} seleccionada{seleccion.size === 1 ? "" : "s"}
              </span>
              <input
                type="text"
                value={categoriaAsignar}
                onChange={(e) => setCategoriaAsignar(e.target.value)}
                placeholder="Categoría a asignar"
                className={cn(INPUT, "h-9 w-[200px]")}
              />
              <button
                type="button"
                onClick={asignarCategoria}
                disabled={!categoriaAsignar.trim()}
                className={cn(BOTON, "h-9 bg-white border border-ink/10 text-ink hover:border-verde-300")}
              >
                Asignar a las seleccionadas
              </button>
            </div>
          )}

          <div className="overflow-x-auto -mx-gap-lg px-gap-lg">
            <table className="w-full border-collapse text-small">
              <thead>
                <tr className="text-left text-meta text-ink-soft/75">
                  <th className="py-gap-xs pr-gap-sm font-medium">#</th>
                  <th className="py-gap-xs pr-gap-sm font-medium">Nombre</th>
                  <th className="py-gap-xs pr-gap-sm font-medium">Categoría</th>
                  <th className="py-gap-xs pr-gap-sm font-medium">Descripción</th>
                  <th className="py-gap-xs pr-gap-sm font-medium">Precio</th>
                  <th className="py-gap-xs pr-gap-sm font-medium">Moneda</th>
                  <th className="py-gap-xs pr-gap-sm font-medium">Estado</th>
                  <th className="py-gap-xs font-medium" />
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.numero} className="border-t border-ink/5 align-top">
                    <td className="py-gap-xs pr-gap-sm">
                      <label className="flex items-center gap-[6px] text-ink-soft/75">
                        <input
                          type="checkbox"
                          checked={seleccion.has(f.numero)}
                          onChange={() => toggle(f.numero)}
                          className="accent-verde-400"
                          aria-label={`Seleccionar fila ${f.numero}`}
                        />
                        {f.numero}
                      </label>
                    </td>
                    <Celda>
                      <input
                        type="text"
                        value={f.nombre}
                        onChange={(e) => editar(f.numero, "nombre", e.target.value)}
                        className={cn(INPUT, "h-9 w-[160px] min-w-0")}
                      />
                    </Celda>
                    <Celda>
                      <input
                        type="text"
                        value={f.categoria}
                        onChange={(e) => editar(f.numero, "categoria", e.target.value)}
                        className={cn(INPUT, "h-9 w-[130px] min-w-0")}
                      />
                    </Celda>
                    <Celda>
                      <input
                        type="text"
                        value={f.descripcion}
                        onChange={(e) => editar(f.numero, "descripcion", e.target.value)}
                        className={cn(INPUT, "h-9 w-[200px] min-w-0")}
                      />
                    </Celda>
                    <Celda>
                      <input
                        type="text"
                        value={f.precio}
                        onChange={(e) => editar(f.numero, "precio", e.target.value)}
                        className={cn(INPUT, "h-9 w-[80px] min-w-0")}
                      />
                    </Celda>
                    <Celda>
                      <select
                        value={f.moneda}
                        onChange={(e) => editar(f.numero, "moneda", e.target.value)}
                        className={cn(INPUT, "h-9 min-w-0 cursor-pointer")}
                      >
                        {MONEDAS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </Celda>
                    <Celda>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-[10px] py-[3px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em]",
                          ESTADO_CLASE[f.estado],
                        )}
                      >
                        {f.estado}
                      </span>
                      {f.motivo && (
                        <p className="text-meta text-ink-soft/75 mt-gap-xs max-w-[220px]">
                          {f.motivo}
                        </p>
                      )}
                    </Celda>
                    <Celda>
                      <button
                        type="button"
                        onClick={() => eliminarFila(f.numero)}
                        aria-label={`Eliminar fila ${f.numero}`}
                        className="size-9 rounded-full border border-ink/10 grid place-items-center text-ink-soft/75 hover:border-destructive/30 hover:text-destructive hover:bg-destructive/10 transition-all duration-500 ease-outquint"
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    </Celda>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-gap-sm">
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={!puedeConfirmar}
              className={cn(BOTON, "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300")}
            >
              {importando && <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />}
              Confirmar importación
            </button>
            <p className="text-meta text-ink-soft/75">
              {resumen.errores > 0
                ? "Corrige los errores para poder importar."
                : resumen.nuevos === 0
                  ? "No hay productos nuevos: todas las filas son duplicados."
                  : "Los duplicados se omiten. No se actualiza ningún producto existente."}
            </p>
          </div>

          {error && <Aviso>{error}</Aviso>}
        </section>
      )}
    </div>
  );
}

function Celda({ children }: { children: ReactNode }) {
  return <td className="py-gap-xs pr-gap-sm">{children}</td>;
}

/**
 * El botón de salida de las pantallas de «importado» y «deshecho».
 *
 * En administración es un enlace —el importador es una ruta propia—; en el
 * panel del negocio no hay a dónde navegar, así que llama a `onVolver`, que
 * cierra el importador y devuelve a la carta.
 */
function Volver({
  href,
  onVolver,
  className,
}: {
  href: string;
  onVolver?: () => void;
  className: string;
}) {
  if (onVolver) {
    return (
      <button type="button" onClick={onVolver} className={className}>
        Volver a la carta
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      Volver a negocios
    </Link>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-gap-xs px-3 py-[7px] rounded-xl bg-destructive/10 border border-destructive/25 text-meta text-destructive font-medium"
    >
      <AlertTriangle size={15} strokeWidth={1.8} className="shrink-0 mt-[1px]" />
      <span>{children}</span>
    </p>
  );
}

function Chip({
  children,
  tono,
}: {
  children: ReactNode;
  tono: "verde" | "arena" | "rojo" | "neutro";
}) {
  const clases: Record<"verde" | "arena" | "rojo" | "neutro", string> = {
    verde: "bg-verde-50 text-verde-600",
    arena: "bg-sand-deep text-ink-soft/75",
    rojo: "bg-destructive/10 text-destructive",
    neutro: "bg-ink/5 text-ink-soft/75",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-[10px] py-[3px] font-lv-display text-[11px] font-semibold",
        clases[tono],
      )}
    >
      {children}
    </span>
  );
}

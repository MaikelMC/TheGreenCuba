"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileUp,
  Image as ImageIcon,
  Loader2,
  Lock,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import { cn, menuTagFallback, menuTagStyles } from "@/lib/utils";
import { aGuardar, conIds, huella } from "@/lib/catalogo";
import { AvailabilityControl } from "@/components/business/menu-item-editor";
import { ImportarCatalogo } from "@/components/admin/importar-catalogo";
import { usePlaces } from "@/providers/places-provider";
import { useCatalogo } from "@/providers/catalogo-provider";
import { prepareImage } from "@/lib/storage/compress";
import { pruneMenuImages } from "@/lib/menu-images";
import type { Disponibilidad } from "@/lib/disponibilidad";
import { limiteDe, type Funcion } from "@/lib/plans";
import type { UserPlace, UserPlaceMenuItem } from "@/lib/places-store";

/* La clave con la que se agrupa lo que no tiene categoría. Un centinela y no
   «Sin categoría» a secas: ese texto es una categoría que el dueño puede
   escribir de verdad, y con el mismo valor las dos se fundirían en un grupo. */
const SIN_CATEGORIA = "\u0000sin";

const INPUT =
  "w-full h-10 px-gap-sm border border-ink/10 rounded-xl font-lv text-small bg-white text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

const BOTON =
  "inline-flex items-center justify-center gap-gap-xs h-11 px-gap-lg rounded-full font-lv-display text-small font-semibold transition-all duration-500 ease-outquint active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

/**
 * La carta, en su propia sección.
 *
 * Antes esto vivía dentro de «Editar ficha», como una lista más entre el horario
 * y las ofertas. Y no son la misma cosa: la ficha se rellena una vez y se deja
 * quieta; la carta se cambia cada semana, se busca un plato concreto, se marca
 * lo que se acabó. Aquí está con lo que eso pide —buscador, filtro por
 * categoría, grupos— y con la importación por CSV, que hasta ahora solo existía
 * en administración.
 *
 * La lista se guarda entera con el mismo `PATCH` de la ficha, en su propia
 * barra: el editor ya no manda `menu`, así que guardar la ficha no puede pisar
 * lo que se cambie aquí.
 */
export function CatalogoView({
  place,
  funciones,
  onVerPlanes,
}: {
  place: UserPlace;
  funciones: Funcion[];
  onVerPlanes: () => void;
}) {
  const router = useRouter();
  const cat = useCatalogo();
  const { updatePlace } = usePlaces();

  const canHoyHay = funciones.includes("hoy_hay");
  const tope = limiteDe(new Set(funciones), "productos_max", cat);

  /* El estado se siembra del negocio y manda a partir de aquí, como el editor:
     sincronizarlo en cada `router.refresh()` borraría lo que se está
     escribiendo. `guardado` es la última versión que está en la base —lo que
     decide si hay cambios sin guardar y qué fotos sobran—. */
  const [items, setItems] = useState<UserPlaceMenuItem[]>(() =>
    conIds(place.menu),
  );
  /* La referencia guardada pasa por `conIds` igual que el estado. Sin eso, una
     carta con productos sin id —los guardados antes de que el id existiera—
     nacería marcada como «sin guardar» y la barra de guardar saldría sola. */
  const guardado = useRef<UserPlaceMenuItem[]>(conIds(place.menu));

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* El producto recién creado: se lleva el foco para que el cursor caiga en su
     nombre sin tener que buscarlo en la lista. */
  const [nuevoId, setNuevoId] = useState<string | null>(null);
  const [subiendoId, setSubiendoId] = useState<string | null>(null);
  const [busyEstado, setBusyEstado] = useState<string | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [mostrarImport, setMostrarImport] = useState(false);
  /* Una importación escribe directamente en la base, así que la lista de aquí
     se queda vieja. Se vuelve a sembrar cuando el `refresh` trae el menú nuevo
     —comparando la referencia, que cambia en cada lectura del servidor—. */
  const [reesembrar, setReesembrar] = useState(false);
  const menuPrevio = useRef<UserPlaceMenuItem[]>(place.menu);

  const inputFoto = useRef<HTMLInputElement>(null);
  const objetivoFoto = useRef<string | null>(null);
  const categoriaListId = useId();

  useEffect(() => {
    if (!reesembrar) return;
    if (place.menu === menuPrevio.current) return;
    menuPrevio.current = place.menu;
    guardado.current = conIds(place.menu);
    setItems(conIds(place.menu));
    setReesembrar(false);
  }, [reesembrar, place.menu]);

  /* El foco del producto recién creado se pide una sola vez. La fila cambia de
     nodo cuando su categoría deja de ser la del grupo en el que está, y
     `autoFocus` se dispara en cada montaje: sin esto, ponerle categoría a un
     producto nuevo devolvía el cursor a su nombre a media edición. */
  useEffect(() => {
    if (nuevoId) setNuevoId(null);
  }, [nuevoId]);

  /* ── Derivados ─────────────────────────────────────────────────────────── */

  const sucio = useMemo(
    () => huella(items) !== huella(guardado.current),
    [items],
  );

  const categorias = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const item of items) {
      const clave = item.category?.trim() || SIN_CATEGORIA;
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    }
    return [...cuenta.entries()].map(([clave, n]) => ({ clave, n }));
  }, [items]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((item) => {
      if (filtro !== null && (item.category?.trim() || SIN_CATEGORIA) !== filtro) {
        return false;
      }
      if (!q) return true;
      return [item.name, item.description, item.category ?? ""].some((v) =>
        v.toLowerCase().includes(q),
      );
    });
  }, [items, busqueda, filtro]);

  /* Se agrupa por el orden en que el dueño creó las categorías, igual que la
     carta pública: dos órdenes para la misma lista se leen como dos listas. */
  const grupos = useMemo(() => {
    const orden: { clave: string; items: UserPlaceMenuItem[] }[] = [];
    const indice = new Map<string, number>();
    for (const item of visibles) {
      const clave = item.category?.trim() || SIN_CATEGORIA;
      let i = indice.get(clave);
      if (i === undefined) {
        i = orden.length;
        indice.set(clave, i);
        orden.push({ clave, items: [] });
      }
      orden[i]!.items.push(item);
    }
    return orden;
  }, [visibles]);

  const nombreCategoria = (clave: string) =>
    clave === SIN_CATEGORIA ? "Sin categoría" : clave;

  /* ── Mutaciones ────────────────────────────────────────────────────────── */

  const patch = useCallback((id: string, campos: Partial<UserPlaceMenuItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...campos } : item)),
    );
  }, []);

  const añadir = useCallback(() => {
    if (tope !== null && items.length >= tope) {
      setError(
        `Tu plan permite hasta ${tope} productos y ya tienes ${items.length}. Quita alguno o mejora tu plan.`,
      );
      return;
    }
    setError(null);
    const id = `new-${Date.now()}`;
    const nuevo: UserPlaceMenuItem = {
      id,
      name: "",
      description: "",
      price: "",
      currency: "MLC",
      /* Si hay una categoría filtrada, el producto nace en ella: es lo que el
         dueño está mirando cuando pulsa «añadir». */
      category: filtro && filtro !== SIN_CATEGORIA ? filtro : undefined,
    };
    setItems((prev) => [nuevo, ...prev]);
    setNuevoId(id);
    setBusqueda("");
  }, [items, filtro, tope]);

  const eliminar = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const elegirFoto = useCallback((id: string) => {
    objetivoFoto.current = id;
    inputFoto.current?.click();
  }, []);

  const subirFoto = useCallback(
    async (file: File | undefined) => {
      const id = objetivoFoto.current;
      objetivoFoto.current = null;
      if (!file || !id) return;

      setSubiendoId(id);
      setError(null);
      try {
        /* Se comprime antes de salir del navegador: aquí los datos son caros. */
        const preparada = await prepareImage(file);
        const form = new FormData();
        form.append("file", preparada.blob, preparada.name);

        const res = await fetch(`/api/places/${place.id}/menu-image`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "No se pudo subir la foto.");
        }
        const creada = (await res.json()) as { url: string };
        patch(id, { image: creada.url });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
      } finally {
        setSubiendoId(null);
      }
    },
    [place.id, patch],
  );

  /**
   * «Hoy hay» escribe al momento, como en el editor: el dueño marca «agotado»
   * cuando se le acaba el plato, no al final de un formulario. El servidor
   * decide —comprueba el plan— y aquí solo se refleja su respuesta.
   */
  const setEstado = useCallback(
    async (id: string, estado: Disponibilidad, hasta?: number | null) => {
      setBusyEstado(id);
      setErrorEstado(null);
      try {
        const res = await fetch(`/api/places/${place.id}/disponibilidad`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productoId: id, estado, hasta: hasta ?? null }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "No se pudo cambiar la disponibilidad.");
        }
        patch(id, {
          disponibilidad: estado,
          agotadoHasta: estado === "agotado" ? hasta ?? null : null,
        });
      } catch (e) {
        setErrorEstado(
          e instanceof Error ? e.message : "No se pudo cambiar la disponibilidad.",
        );
      } finally {
        setBusyEstado(null);
      }
    },
    [place.id, patch],
  );

  const guardar = useCallback(async () => {
    if (items.some((item) => !item.name.trim())) {
      setError(
        "Hay un producto sin nombre. Ponle uno o bórralo antes de guardar.",
      );
      return;
    }
    setError(null);
    setSaving(true);

    /* La lista blanca vive en `aGuardar`, con su prueba al lado: aquí dentro no
       se ve cuál de estos campos se queda fuera hasta que ya no está. */
    const limpio = aGuardar(items);

    const saved = await updatePlace(place.id, { menu: limpio });
    setSaving(false);

    if (!saved) {
      setError(
        "No se pudo guardar. Revisa la conexión e inténtalo otra vez: no se cambió nada.",
      );
      return;
    }

    /* Ya escrito en la base: las fotos que este guardado dejó fuera se retiran
       del bucket. Antes no, por lo que explica `pruneMenuImages`. */
    pruneMenuImages(place.id, guardado.current, limpio);
    guardado.current = limpio;
    setItems(limpio);
    setNuevoId(null);
    toast.success("Carta guardada");
    /* El catálogo público y el panel son de servidor: sin esto siguen leyendo
       la carta vieja hasta que caduque la caché. */
    router.refresh();
  }, [items, place.id, updatePlace, router]);

  const alcanzoTope = tope !== null && items.length >= tope;

  return (
    <>
      <h1 className="sr-only">Catálogo</h1>

      {/* Un solo input para toda la lista: cada producto lleva una sola foto. */}
      <input
        ref={inputFoto}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void subirFoto(file);
        }}
      />

      {/* Sugerencias y no lista cerrada: la categoría la inventa el dueño. Los
          productos sin categoría no salen aquí: su clave es un centinela y
          ofrecerlo era invitar a crear una categoría llamada «Sin categoría»
          —dos grupos con el mismo encabezado en la misma carta—. */}
      <datalist id={categoriaListId}>
        {categorias
          .filter((c) => c.clave !== SIN_CATEGORIA)
          .map((c) => (
            <option key={c.clave} value={c.clave} />
          ))}
      </datalist>

      {/* ── Buscador y acciones ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-gap-sm sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/50"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, descripción o categoría"
            aria-label="Buscar en el catálogo"
            className={cn(INPUT, "pl-9 font-lv-display")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-gap-sm">
          <button
            type="button"
            /* Con cambios sin guardar no se abre: la importación escribe en el
               servidor sobre la carta **guardada** y al volver a leerla se
               llevaría por delante lo que hay en pantalla sin guardar. Se
               explica debajo, que es lo que hace que un botón apagado no
               parezca roto. */
            disabled={sucio && !mostrarImport}
            onClick={() => {
              setError(null);
              setMostrarImport((v) => !v);
            }}
            aria-expanded={mostrarImport}
            className={cn(
              BOTON,
              "bg-white border border-ink/10 text-ink hover:border-verde-300 hover:text-verde-600",
            )}
          >
            <FileUp size={16} strokeWidth={1.8} />
            Importar CSV
          </button>
          <button
            type="button"
            onClick={añadir}
            disabled={alcanzoTope}
            className={cn(BOTON, "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300")}
          >
            {alcanzoTope ? (
              <Lock size={16} strokeWidth={1.8} />
            ) : (
              <Plus size={16} strokeWidth={1.8} />
            )}
            Añadir producto
          </button>
        </div>
      </div>

      {sucio && !mostrarImport && (
        <p className="mt-gap-sm text-meta text-ink-soft/75">
          Guarda la carta para poder importar: el CSV se suma a lo guardado.
        </p>
      )}

      {/* ── Resumen y filtros ───────────────────────────────────────────── */}
      <div className="mt-gap-md flex flex-col gap-gap-sm">
        <p className="text-meta text-ink-soft/75">
          {items.length} producto{items.length === 1 ? "" : "s"}
          {tope !== null ? ` de ${tope} — el tope de tu plan` : " en la carta"}
        </p>

        {/* Una sola fila que se desliza, como la de la carta pública: los
            filtros llevan `shrink-0` y `whitespace-nowrap` sobre un alto fijo,
            así que quedan todos a la misma altura y ninguno parte su nombre en
            dos líneas, que era lo que descuadraba la fila.

            `carta-filtros-scroll` es el degradado de la carta y no un CSS
            nuevo: el aviso de «hay más a la derecha» es el mismo problema y se
            resuelve igual. El relleno vertical, con su margen negativo, es lo
            que deja sitio a la sombra de la pastilla activa: `overflow-x`
            recorta también en vertical y el desenfoque saldría cortado a media
            altura. */}
        {categorias.length > 0 && (
          <div className="carta-filtros-scroll scrollbar-hide -my-[6px] flex flex-nowrap items-center gap-[6px] overflow-x-auto py-[6px]">
            <Filtro
              activo={filtro === null}
              onClick={() => setFiltro(null)}
              cuenta={items.length}
            >
              Todas
            </Filtro>
            {categorias.map((c) => (
              <Filtro
                key={c.clave}
                activo={filtro === c.clave}
                onClick={() =>
                  setFiltro((prev) => (prev === c.clave ? null : c.clave))
                }
                cuenta={c.n}
              >
                {nombreCategoria(c.clave)}
              </Filtro>
            ))}
          </div>
        )}
      </div>

      {alcanzoTope && (
        <div className="mt-gap-sm flex flex-wrap items-center gap-gap-sm rounded-xl border border-ink/10 bg-sand-deep/50 px-gap-md py-gap-sm">
          <p className="min-w-0 flex-1 text-meta text-ink-soft/75">
            Llegaste a los {tope} productos de tu plan. Para pasar de ahí hay
            que subir de plan.
          </p>
          {onVerPlanes && (
            <button
              type="button"
              onClick={onVerPlanes}
              className="shrink-0 cursor-pointer rounded-full border border-ink/10 bg-white px-gap-md py-2 font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-600"
            >
              Ver planes
            </button>
          )}
        </div>
      )}

      {/* ── Importación ─────────────────────────────────────────────────── */}
      {mostrarImport && (
        <section className="mt-gap-md">
          <div className="mb-gap-sm flex items-center justify-between gap-gap-sm">
            <h2 className="font-lv-display text-body font-semibold text-ink">
              Importar catálogo
            </h2>
            <button
              type="button"
              onClick={() => setMostrarImport(false)}
              className="cursor-pointer text-meta text-ink-soft/75 transition-colors duration-500 ease-outquint hover:text-verde-600"
            >
              Cerrar
            </button>
          </div>
          <ImportarCatalogo
            key={place.id}
            placeId={place.id}
            existentes={items.map((i) => ({
              nombre: i.name,
              categoria: i.category,
            }))}
            /* Al importar y al deshacer, no al «volver»: las dos escriben en la
               base mientras esta pantalla sigue con su copia, y entre una cosa
               y la otra se puede guardar esa copia encima. Releer al momento
               cierra esa ventana. */
            onCartaCambiada={() => {
              setReesembrar(true);
              router.refresh();
            }}
            onVolver={() => setMostrarImport(false)}
          />
        </section>
      )}

      {/* ── La carta ────────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <EstadoVacio
          titulo="Tu carta está vacía"
          texto="Añade tu primer producto —o sube la carta entera desde un CSV— y aparecerá en tu ficha y en el menú público."
          accion={
            <button
              type="button"
              onClick={añadir}
              className={cn(BOTON, "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300")}
            >
              <Plus size={16} strokeWidth={1.8} />
              Añadir producto
            </button>
          }
        />
      ) : visibles.length === 0 ? (
        <EstadoVacio
          titulo="Nada coincide"
          texto="Ningún producto responde a esa búsqueda o a este filtro."
          accion={
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setFiltro(null);
              }}
              className={cn(BOTON, "bg-white border border-ink/10 text-ink hover:border-verde-300")}
            >
              Quitar filtros
            </button>
          }
        />
      ) : (
        <div className="mt-gap-lg flex flex-col gap-gap-lg">
          {grupos.map((grupo) => (
            <section key={grupo.clave} className="flex flex-col">
              <h2 className="mb-gap-xs flex items-baseline gap-gap-xs font-lv-display text-body font-semibold text-ink">
                {nombreCategoria(grupo.clave)}
                <span className="text-meta font-medium text-ink-soft/65">
                  {grupo.items.length}
                </span>
              </h2>
              <div className="rounded-2xl border border-ink/5 bg-white px-gap-md">
                {grupo.items.map((item) => (
                  <FilaProducto
                    key={item.id}
                    item={item}
                    recienCreado={item.id === nuevoId}
                    subiendo={subiendoId === item.id}
                    canHoyHay={canHoyHay}
                    /* «Hoy hay» escribe al momento contra el producto que ya
                       está en la base: en uno recién añadido y sin guardar
                       contestaba «Producto no encontrado». Se pregunta por
                       `guardado`, que es justo la lista que sí está guardada. */
                    persistido={guardado.current.some((p) => p.id === item.id)}
                    busyEstado={busyEstado === item.id}
                    listaCategorias={categoriaListId}
                    onPatch={patch}
                    onEliminar={eliminar}
                    onElegirFoto={elegirFoto}
                    onSetEstado={setEstado}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {(error || errorEstado) && (
        <p
          role="alert"
          className="mt-gap-md rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-destructive"
        >
          {error ?? errorEstado}
        </p>
      )}

      {/* La barra solo aparece con algo que guardar: si no, es un botón que no
          hace nada ocupando sitio en cada visita. */}
      {sucio && (
        <div className="sticky bottom-4 z-40 mt-gap-lg flex justify-end">
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={saving}
            className="inline-flex h-12 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Save size={16} strokeWidth={1.8} />
            )}
            {saving ? "Guardando…" : "Guardar carta"}
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Una fila de la carta.
 *
 * Misma información que la del editor de administración, pero en su propio
 * componente: aquí la lista se filtra y se agrupa, y meter eso dentro del editor
 * habría obligado a que el editor supiera de búsquedas para dos pantallas que no
 * las piden igual.
 */
function FilaProducto({
  item,
  recienCreado,
  subiendo,
  canHoyHay,
  persistido,
  busyEstado,
  listaCategorias,
  onPatch,
  onEliminar,
  onElegirFoto,
  onSetEstado,
}: {
  item: UserPlaceMenuItem;
  recienCreado: boolean;
  subiendo: boolean;
  canHoyHay: boolean;
  /** Ya está en la base: «Hoy hay» escribe contra el producto guardado. */
  persistido: boolean;
  busyEstado: boolean;
  listaCategorias: string;
  onPatch: (id: string, campos: Partial<UserPlaceMenuItem>) => void;
  onEliminar: (id: string) => void;
  onElegirFoto: (id: string) => void;
  onSetEstado: (
    id: string,
    estado: Disponibilidad,
    hasta?: number | null,
  ) => void;
}) {
  const id = item.id ?? "";
  const nombre = item.name || "este producto";

  /* La categoría se escribe aquí y se manda al salir del campo. El porqué está
     donde se usa; el estado es local porque la fila deja de existir en cuanto
     se manda: no hay dónde guardarlo fuera. */
  const [categoria, setCategoria] = useState(item.category ?? "");

  /** Vuelca lo escrito, ya recortado —que es como lo deja `aGuardar`— para que
      el campo y lo guardado no se separen tras un guardado. */
  const commitCategoria = () => {
    const limpia = categoria.trim();
    setCategoria(limpia);
    if (limpia !== (item.category ?? "")) onPatch(id, { category: limpia });
  };

  return (
    <div className="group flex items-start gap-gap-sm border-b border-ink/5 py-gap-sm last:border-b-0">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border border-ink/5 transition-colors duration-500 ease-outquint group-hover:border-verde-300 sm:size-16">
        <button
          type="button"
          onClick={() => onElegirFoto(id)}
          disabled={subiendo}
          aria-label={
            item.image ? `Cambiar la foto de ${nombre}` : `Añadir foto a ${nombre}`
          }
          className="absolute inset-0 grid cursor-pointer place-items-center text-verde-400 transition-colors duration-500 ease-outquint hover:bg-ink/5"
        >
          {subiendo ? (
            <Loader2 size={20} strokeWidth={1.8} className="animate-spin" />
          ) : item.image ? (
            <Image
              src={item.image}
              alt={item.name ? `Foto de ${item.name}` : ""}
              fill
              sizes="(min-width: 640px) 64px, 56px"
              className="object-cover"
            />
          ) : (
            <ImageIcon size={20} strokeWidth={1.8} />
          )}
        </button>
        {item.image && !subiendo && (
          <button
            type="button"
            onClick={() => onPatch(id, { image: undefined })}
            aria-label={`Quitar la foto de ${nombre}`}
            className="absolute right-[4px] top-[4px] z-10 grid size-5 cursor-pointer place-items-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity duration-500 ease-outquint focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X size={12} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-gap-xs">
        <input
          type="text"
          value={item.name}
          autoFocus={recienCreado}
          onChange={(e) => onPatch(id, { name: e.target.value })}
          placeholder="Nombre del producto o servicio"
          aria-label="Nombre del producto"
          className={cn(INPUT, "font-semibold")}
        />
        <input
          type="text"
          value={item.description}
          onChange={(e) => onPatch(id, { description: e.target.value })}
          placeholder="Descripción breve"
          aria-label="Descripción del producto"
          className={cn(INPUT, "text-meta text-ink-soft/75")}
        />
        {/* `flex-wrap` para que la etiqueta caiga abajo cuando no quepa, en vez
            de empujar la fila fuera de la tarjeta en el móvil. */}
        <div className="flex flex-wrap items-center gap-gap-xs">
          <input
            type="text"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            /* Al salir del campo y no en cada tecla: la carta se agrupa por
               categoría, así que en cuanto la del producto deja de ser la del
               grupo la fila se muda a otra sección —nodo nuevo— y el foco se va
               con el nodo viejo. Mandándolo en cada tecla, el campo soltaba el
               cursor a la primera letra: no se podía corregir una categoría ni
               escribir una nueva. */
            onBlur={commitCategoria}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder="Categoría"
            list={listaCategorias}
            aria-label="Categoría del producto"
            className={cn(INPUT, "w-[124px] min-w-0 text-meta sm:w-[148px]")}
          />
          <input
            type="text"
            value={item.price}
            onChange={(e) => onPatch(id, { price: e.target.value })}
            placeholder="0"
            aria-label="Precio"
            className={cn(INPUT, "w-[64px] min-w-0 font-lv-display sm:w-[80px]")}
          />
          <select
            value={item.currency}
            onChange={(e) => onPatch(id, { currency: e.target.value })}
            aria-label="Moneda del producto"
            className={cn(INPUT, "min-w-0 cursor-pointer font-lv-display text-meta")}
          >
            <option value="MLC">USD Clásica</option>
            <option value="CUP">CUP</option>
            <option value="USD">USD</option>
            {/* EUR falta en el `<select>` y sí está en `MONEDAS` del importador:
                una carta importada con precios en euros se quedaba con el
                desplegable en blanco y no había forma de volver a elegirla. */}
            <option value="EUR">EUR</option>
          </select>
          {item.tag && (
            <span
              className={cn(
                "rounded-full px-[10px] py-[3px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em]",
                menuTagStyles[item.tag] ?? menuTagFallback,
              )}
            >
              {item.tag}
            </span>
          )}
        </div>

        {canHoyHay && persistido && (
          <AvailabilityControl
            item={item}
            busy={busyEstado}
            onSet={(estado, hasta) => void onSetEstado(id, estado, hasta)}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => onEliminar(id)}
        aria-label={`Eliminar ${nombre}`}
        className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-ink/10 text-ink-soft/75 transition-all duration-500 ease-outquint hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
      >
        <X size={16} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function Filtro({
  activo,
  cuenta,
  onClick,
  children,
}: {
  activo: boolean;
  cuenta: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        /* Alto fijo y `items-center` —los mismos 36 px del chip de la carta—
           para que la fila no se escalone cuando una categoría trae un nombre
           largo; `shrink-0` y `whitespace-nowrap` porque la fila ya no
           envuelve: si la pastilla se encogiera, el nombre partiría en dos
           líneas dentro de una pastilla más baja que sus vecinas. */
        "inline-flex h-9 shrink-0 cursor-pointer select-none items-center whitespace-nowrap rounded-full border px-[14px] font-lv-display text-meta font-medium transition-all duration-500 ease-outquint active:scale-[0.98]",
        activo
          ? "border-verde-400 bg-verde-400 text-verde-950 shadow-soft"
          : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
      )}
    >
      {children}
      <span className={cn("ml-[6px]", activo ? "text-verde-950/70" : "text-ink-soft/50")}>
        {cuenta}
      </span>
    </button>
  );
}

function EstadoVacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto: string;
  accion: React.ReactNode;
}) {
  return (
    <div className="mt-gap-lg flex flex-col items-center gap-gap-sm rounded-2xl border border-dashed border-ink/10 bg-white/60 px-gap-lg py-gap-xl text-center">
      <h2 className="font-lv-display text-body font-semibold text-ink">{titulo}</h2>
      <p className="max-w-[42ch] text-small text-ink-soft/75">{texto}</p>
      {accion}
    </div>
  );
}


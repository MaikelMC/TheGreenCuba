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
import { clsx } from "clsx";
import { mensajeDeRed } from "@/lib/errores-red";
import {
  Ellipsis,
  Eye,
  EyeOff,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Lock,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { cn, menuTagFallback, menuTagStyles } from "@/lib/utils";
import { INPUT_NATIVO, TONO_CHAPITA } from "@/components/business/ui/clases";
import {
  BotonIcono,
  BotonPrimario,
  BotonSecundario,
  BotonTexto,
} from "@/components/business/ui/botones";
import { Chapita, TarjetaPanel } from "@/components/business/ui/tarjeta";
import { CandadoPlan } from "@/components/business/ui/candado-plan";
import { Switch } from "@/components/business/ui/switch";
import { HojaPanel } from "@/components/business/ui/hoja-panel";
import { OfertaRapida } from "@/components/business/oferta-rapida";
import { usePanelNav } from "@/components/business/panel-shell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  aGuardar,
  conIds,
  diferenciasCatalogo,
  huella,
  type OperacionesCatalogo,
} from "@/lib/catalogo";
import { convertirPrecio } from "@/lib/productos";
import { DEV_PLACE_ID } from "@/lib/dev-place-id";
import { AvailabilityControl } from "@/components/business/menu-item-editor";
import { ImportarCatalogo } from "@/components/admin/importar-catalogo";
import { usePlaces } from "@/providers/places-provider";
import { useCatalogo } from "@/providers/catalogo-provider";
import { prepareImage } from "@/lib/storage/compress";
import { pruneMenuImages } from "@/lib/menu-images";
import { estaAgotado, hastaManana, type Disponibilidad } from "@/lib/disponibilidad";
import { bloqueoDe, limiteDe, type Funcion } from "@/lib/plans";
import { registrarGuarda } from "@/lib/unsaved-guard";
import type { UserPlace, UserPlaceMenuItem } from "@/lib/places-store";
import { preciosDeItem, type ConfigTasa } from "@/lib/precios";

/* La clave con la que se agrupa lo que no tiene categoría. Un centinela y no
   «Sin categoría» a secas: ese texto es una categoría que el dueño puede
   escribir de verdad, y con el mismo valor las dos se fundirían en un grupo. */
const SIN_CATEGORIA = "\u0000sin";

/* El filtro de agotados. No es una categoría, pero se elige desde la misma fila
   de pastillas, así que comparte estado con ellas. Lleva delante el centinela de
   arriba por el mismo motivo: una categoría escrita a mano no puede empezar por
   un carácter nulo, así que los dos valores no pueden confundirse. */
const AGOTADOS = `${SIN_CATEGORIA}agotados`;

/* Alto 44 px y, en el móvil, 16 px de texto: por debajo de 16 el navegador de
   iOS hace zoom al enfocar el campo y la fila entera se sale del encuadre. En
   escritorio baja a 14 px, que es lo que pide la densidad de la lista. El anillo
   de foco lo pone `Input` —el del sistema—, así que aquí solo se cambia el color
   del borde al enfocar. */
const INPUT = `${INPUT_NATIVO} sm:text-small`;

const BOTON =
  "inline-flex items-center justify-center gap-gap-xs h-11 px-gap-lg rounded-full font-lv-display text-small font-semibold transition duration-500 ease-outquint active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40 focus-visible:ring-offset-2";

/** El borrador del catálogo entero de antes del guardado por producto. */
function claveBorradorViejo(placeId: string): string {
  return `la-verde:catalogo-borrador:${placeId}`;
}

/** Recorta un precio a lo que puede ser un número: dígitos, coma, punto y aire. */
function limpiarPrecio(valor: string): string {
  return valor.replace(/[^\d.,\s]/g, "").slice(0, 14);
}

const OPS_VACIAS: OperacionesCatalogo = { crear: [], actualizar: [], borrar: [] };

/**
 * Las mismas operaciones, aplicadas sobre la lista en el navegador. Solo para el
 * negocio de prueba, que guarda su carta entera con el `PATCH` de la ficha.
 */
function aplicarLocal(
  items: UserPlaceMenuItem[],
  ops: OperacionesCatalogo,
): UserPlaceMenuItem[] {
  const lista = items
    .filter((item) => !ops.borrar.includes(item.id ?? ""))
    .map((item) => {
      const op = ops.actualizar.find((o) => o.id === item.id);
      if (!op) return item;
      const fusion: Record<string, unknown> = { ...item };
      for (const [campo, valor] of Object.entries(op.cambios)) {
        if (valor === null || valor === undefined) delete fusion[campo];
        else fusion[campo] = valor;
      }
      return fusion as unknown as UserPlaceMenuItem;
    });
  for (const { idTemporal, item } of ops.crear) lista.push({ ...item, id: idTemporal });
  return lista;
}

type Resultado =
  | {
      ok: true;
      productos: UserPlaceMenuItem[];
      conflictos: { id: string; actual: UserPlaceMenuItem | null }[];
    }
  | { ok: false; error: string };

interface Edicion {
  /** `null` = producto nuevo. */
  original: UserPlaceMenuItem | null;
  /** Con lo que se abrió la hoja: decide si hay cambios sin guardar. */
  inicial: UserPlaceMenuItem;
  draft: UserPlaceMenuItem;
  /** Otro lo cambió desde el móvil: `null` si ya no existe. */
  conflicto?: UserPlaceMenuItem | null;
}

/**
 * El catálogo, con dos modos:
 *
 * - **Hoy hay** (por defecto en el móvil): la lista corta para el día a día,
 *   con el interruptor Hay/Agotado de cada producto. Guarda al momento por la
 *   ruta de disponibilidad y el aviso trae «Deshacer». «⋯» → agotado hasta
 *   mañana.
 * - **Editar carta**: la lista con miniaturas. Tocar un producto lo abre en una
 *   hoja con su propio «Guardar», que manda **una sola operación** a
 *   `POST /api/places/[id]/productos`: los cambios de ese producto con su
 *   versión. El servidor fusiona solo esos campos sobre la fila actual y, si
 *   otro la cambió mientras tanto (Telegram, otro trabajador), devuelve un
 *   conflicto en vez de pisarla: la hoja avisa «cambió desde el móvil».
 *
 * Con el guardado por producto ya no hay barra global de guardar ni borrador de
 * la carta entera. El negocio de prueba, que no tiene filas en `productos`,
 * guarda igual por producto pero con el `PATCH` de la ficha y la carta entera.
 */
export function CatalogoView({
  place,
  funciones,
  configTasa = null,
  onVerPlanes,
  modoInicial = null,
}: {
  place: UserPlace;
  funciones: Funcion[];
  configTasa?: ConfigTasa | null;
  onVerPlanes: () => void;
  /** `sub` de la URL: `hoy-hay`, `editar` o sin elegir (depende de la pantalla). */
  modoInicial?: "hoy-hay" | "editar" | null;
}) {
  const router = useRouter();
  const cat = useCatalogo();
  const nav = usePanelNav();
  const { updatePlace } = usePlaces();

  const canHoyHay = funciones.includes("hoy_hay");
  const conOfertas = funciones.includes("ofertas_flash");
  const tope = limiteDe(new Set(funciones), "productos_max", cat);
  const bloqueoHoyHay = bloqueoDe(funciones, "hoy_hay", cat);

  /* La lista es la de la base: ya no hay cambios locales sin guardar, así que
     se vuelve a sembrar cada vez que el servidor trae la carta nueva. */
  const [items, setItems] = useState<UserPlaceMenuItem[]>(() => conIds(place.menu));
  useEffect(() => setItems(conIds(place.menu)), [place.menu]);

  /* Sin modo en la URL, el móvil abre en «Hoy hay» y el escritorio en «Editar
     carta». Se decide tras montar: el servidor no sabe el ancho. */
  const [modo, setModo] = useState<"hoy-hay" | "editar">(modoInicial ?? "hoy-hay");
  useEffect(() => {
    if (modoInicial) return;
    if (window.matchMedia("(min-width: 1024px)").matches) setModo("editar");
  }, [modoInicial]);

  /* El borrador de la carta entera era del guardado viejo: se limpia. */
  useEffect(() => {
    try {
      window.localStorage.removeItem(claveBorradorViejo(place.id));
    } catch {
      /* Sin almacén, nada que limpiar. */
    }
  }, [place.id]);

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<string | null>(null);
  /* El error del tope va aparte porque se pinta pegado al botón que lo provoca. */
  const [errorTope, setErrorTope] = useState<string | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const reintentarEstado = useRef<(() => void) | null>(null);
  const [busyEstado, setBusyEstado] = useState<string | null>(null);
  const [masAbierto, setMasAbierto] = useState<string | null>(null);
  const [mostrarImport, setMostrarImport] = useState(false);

  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [errorProducto, setErrorProducto] = useState<string | null>(null);
  const [subiendoId, setSubiendoId] = useState<string | null>(null);
  /* El producto del menú «⋯» y el de «Poner en oferta». */
  const [menuDe, setMenuDe] = useState<UserPlaceMenuItem | null>(null);
  const [ofertaDe, setOfertaDe] = useState<string | null>(null);

  /* Selección múltiple (Editar carta). `null` = apagada. */
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null);
  const [categoriaLote, setCategoriaLote] = useState("");
  const [enLote, setEnLote] = useState(false);

  /* Las fotos de un producto borrado se podan pasados los 7 s del «Deshacer». */
  const podasPendientes = useRef(new Map<string, number>());

  const inputFoto = useRef<HTMLInputElement>(null);
  const objetivoFoto = useRef<string | null>(null);
  const categoriaListId = useId();

  /* ── Derivados ─────────────────────────────────────────────────────────── */

  const categorias = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const item of items) {
      const clave = item.category?.trim() || SIN_CATEGORIA;
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    }
    return [...cuenta.entries()].map(([clave, n]) => ({ clave, n }));
  }, [items]);

  const agotados = useMemo(() => items.filter((item) => estaAgotado(item)).length, [items]);

  useEffect(() => {
    if (filtro === AGOTADOS && agotados === 0) setFiltro(null);
  }, [filtro, agotados]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((item) => {
      if (filtro === AGOTADOS) {
        if (!estaAgotado(item)) return false;
      } else if (filtro !== null && (item.category?.trim() || SIN_CATEGORIA) !== filtro) {
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

  const nombreCategoria = (clave: string) => (clave === SIN_CATEGORIA ? "Sin categoría" : clave);

  const categoriasUsadas = useMemo(
    () => categorias.map((c) => c.clave).filter((clave) => clave !== SIN_CATEGORIA),
    [categorias],
  );

  const sucioProducto = edicion !== null && huella([edicion.draft]) !== huella([edicion.inicial]);

  /* Con un producto a medio editar, salir de la sección pregunta. Cerrar la
     hoja también (ver `cerrarEditor`). */
  useEffect(() => {
    if (!sucioProducto) return;
    return registrarGuarda(() =>
      window.confirm("Tienes cambios sin guardar en este producto. Si sales se descartan. ¿Salir igual?"),
    );
  }, [sucioProducto]);

  /* Si la hoja se cerró por otro camino (atrás del sistema), se suelta la
     edición. */
  useEffect(() => {
    if (nav.hoja !== "producto" && edicion) {
      setEdicion(null);
      setErrorProducto(null);
    }
    if (nav.hoja !== "acciones" && menuDe) setMenuDe(null);
  }, [nav.hoja, edicion, menuDe]);

  /* ── Escritura ─────────────────────────────────────────────────────────── */

  /** Manda unas operaciones y devuelve la carta del servidor y los conflictos. */
  const enviar = useCallback(
    async (ops: OperacionesCatalogo): Promise<Resultado> => {
      if (place.id === DEV_PLACE_ID) {
        const lista = aGuardar(aplicarLocal(items, ops));
        const guardado = await updatePlace(place.id, { menu: lista });
        if (!guardado) {
          return { ok: false, error: "No se pudo guardar. Revisa la conexión: no se cambió nada." };
        }
        return { ok: true, productos: conIds(guardado.menu ?? lista), conflictos: [] };
      }
      try {
        const res = await fetch(`/api/places/${place.id}/productos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ops),
        });
        const cuerpo = (await res.json().catch(() => null)) as {
          productos?: UserPlaceMenuItem[];
          conflictos?: { id: string; actual: UserPlaceMenuItem | null }[];
          error?: string;
        } | null;
        if (!res.ok || !cuerpo?.productos) {
          return { ok: false, error: cuerpo?.error ?? "No se pudo guardar." };
        }
        return { ok: true, productos: conIds(cuerpo.productos), conflictos: cuerpo.conflictos ?? [] };
      } catch (e) {
        return {
          ok: false,
          error: mensajeDeRed(e, "No se pudo guardar. Revisa la conexión: no se cambió nada."),
        };
      }
    },
    [items, place.id, updatePlace],
  );

  /** Vuelca la carta del servidor y refresca la ficha pública. */
  const adoptar = useCallback(
    (productos: UserPlaceMenuItem[], podar = true) => {
      if (podar) pruneMenuImages(place.id, items, productos);
      setItems(productos);
      router.refresh();
    },
    [items, place.id, router],
  );

  /**
   * «Hoy hay» escribe al momento: el dueño marca «agotado» cuando se le acaba el
   * plato, no al final de un formulario. El servidor comprueba el plan. El aviso
   * trae «Deshacer», que vuelve al estado anterior por la misma ruta.
   */
  const setEstado = useCallback(
    async (id: string, estado: Disponibilidad, hasta?: number | null, deshacible = true) => {
      const previo = items.find((item) => item.id === id);
      setBusyEstado(id);
      setErrorEstado(null);
      try {
        const res = await fetch(`/api/places/${place.id}/disponibilidad`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productoId: id, estado, hasta: hasta ?? null }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "No se pudo cambiar la disponibilidad.");
        }
        const respuesta = (await res.json().catch(() => null)) as { version?: number } | null;
        const campos = {
          disponibilidad: estado,
          agotadoHasta: estado === "agotado" ? (hasta ?? null) : null,
          /* La versión nueva: sin ella, el siguiente guardado de este producto
             chocaría con su propio cambio. */
          ...(typeof respuesta?.version === "number" ? { version: respuesta.version } : {}),
        };
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...campos } : item)));
        setEdicion((e) =>
          e && e.draft.id === id
            ? {
                ...e,
                original: e.original && { ...e.original, ...campos },
                inicial: { ...e.inicial, ...campos },
                draft: { ...e.draft, ...campos },
              }
            : e,
        );
        reintentarEstado.current = null;
        const accion =
          estado === "disponible"
            ? "marcado como disponible"
            : hasta != null
              ? "agotado hasta mañana"
              : "marcado como agotado";
        const estabaAgotado = previo ? estaAgotado(previo) : false;
        toast.success(previo?.name ? `«${previo.name}» ${accion}` : `Producto ${accion}`, {
          action:
            deshacible && previo
              ? {
                  label: "Deshacer",
                  onClick: () =>
                    void setEstado(
                      id,
                      estabaAgotado ? "agotado" : "disponible",
                      estabaAgotado ? (previo.agotadoHasta ?? null) : null,
                      false,
                    ),
                }
              : undefined,
        });
        router.refresh();
      } catch (e) {
        setErrorEstado(mensajeDeRed(e, "No se pudo cambiar la disponibilidad."));
        reintentarEstado.current = () => void setEstado(id, estado, hasta, deshacible);
      } finally {
        setBusyEstado(null);
      }
    },
    [items, place.id, router],
  );

  /* ── La hoja de un producto ────────────────────────────────────────────── */

  const abrirEditor = useCallback(
    (item: UserPlaceMenuItem | null) => {
      if (!item && tope !== null && items.length >= tope) {
        setErrorTope(
          `Tu plan permite hasta ${tope} productos y ya tienes ${items.length}. Quita alguno o mejora tu plan.`,
        );
        return;
      }
      setErrorTope(null);
      setErrorProducto(null);
      const base: UserPlaceMenuItem = item ?? {
        id: `new-${Date.now()}`,
        name: "",
        description: "",
        price: "",
        currency: "MLC",
        /* Si hay una categoría filtrada, el producto nace en ella: es lo que el
           dueño está mirando cuando pulsa «Añadir». */
        category: filtro && filtro !== SIN_CATEGORIA && filtro !== AGOTADOS ? filtro : undefined,
      };
      setEdicion({ original: item, inicial: base, draft: base });
      nav.abrirHoja("producto");
    },
    [filtro, items.length, nav, tope],
  );

  const cerrarEditor = useCallback(() => {
    if (sucioProducto && !window.confirm("Hay cambios sin guardar en este producto. ¿Descartarlos?")) {
      return;
    }
    setEdicion(null);
    nav.cerrarHoja();
  }, [nav, sucioProducto]);

  const patchDraft = useCallback((_id: string, campos: Partial<UserPlaceMenuItem>) => {
    setEdicion((e) => (e ? { ...e, draft: { ...e.draft, ...campos } } : e));
  }, []);

  const guardarProducto = useCallback(async () => {
    if (!edicion || guardandoProducto) return;
    if (!edicion.draft.name.trim()) {
      setErrorProducto("Ponle un nombre al producto antes de guardar.");
      return;
    }
    const [limpio] = aGuardar([edicion.draft]);
    if (!limpio) return;
    let ops: OperacionesCatalogo;
    if (!edicion.original) {
      ops = { ...OPS_VACIAS, crear: [{ idTemporal: limpio.id ?? "", item: limpio }] };
    } else {
      const [original] = aGuardar([edicion.original]);
      const diferencias = diferenciasCatalogo([original ?? edicion.original], [limpio]);
      if (diferencias.actualizar.length === 0) {
        setEdicion(null);
        nav.cerrarHoja();
        return;
      }
      ops = { ...OPS_VACIAS, actualizar: diferencias.actualizar };
    }
    setErrorProducto(null);
    setGuardandoProducto(true);
    const resultado = await enviar(ops);
    setGuardandoProducto(false);
    if (!resultado.ok) {
      setErrorProducto(resultado.error);
      return;
    }
    const choque = edicion.original
      ? resultado.conflictos.find((c) => c.id === edicion.original?.id)
      : undefined;
    if (choque) {
      /* No se pisa lo de otro: se adopta la carta (con su versión del
         producto) y la hoja se queda abierta con lo que escribió el dueño. */
      adoptar(resultado.productos, false);
      setEdicion((e) => (e ? { ...e, conflicto: choque.actual } : e));
      return;
    }
    adoptar(resultado.productos);
    toast.success(edicion.original ? "Producto guardado" : "Producto añadido");
    setEdicion(null);
    nav.cerrarHoja();
  }, [adoptar, edicion, enviar, guardandoProducto, nav]);

  /** Carga en la hoja la versión que hay en la base, tras un conflicto. */
  const recargarProducto = useCallback(() => {
    if (!edicion) return;
    if (edicion.conflicto === null) {
      toast.info("Ese producto ya no está en la carta.");
      setEdicion(null);
      nav.cerrarHoja();
      return;
    }
    if (edicion.conflicto) {
      const actual = edicion.conflicto;
      setEdicion({ original: actual, inicial: actual, draft: actual });
    }
  }, [edicion, nav]);

  const elegirFoto = useCallback((id: string) => {
    objetivoFoto.current = id;
    inputFoto.current?.click();
  }, []);

  /* La foto se sube al momento (el servidor guarda el archivo) y queda en el
     borrador del producto: se guarda con su «Guardar». */
  const subirFoto = useCallback(
    async (file: File | undefined) => {
      const id = objetivoFoto.current;
      objetivoFoto.current = null;
      if (!file || !id) return;
      setSubiendoId(id);
      setErrorProducto(null);
      try {
        const preparada = await prepareImage(file);
        const form = new FormData();
        form.append("file", preparada.blob, preparada.name);
        const res = await fetch(`/api/places/${place.id}/menu-image`, { method: "POST", body: form });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "No se pudo subir la foto.");
        }
        const creada = (await res.json()) as { url: string };
        patchDraft(id, { image: creada.url });
      } catch (e) {
        setErrorProducto(mensajeDeRed(e, "No se pudo subir la foto."));
      } finally {
        setSubiendoId(null);
      }
    },
    [place.id, patchDraft],
  );

  /* ── Acciones sobre un producto guardado ───────────────────────────────── */

  const restaurar = useCallback(
    async (item: UserPlaceMenuItem) => {
      const poda = podasPendientes.current.get(item.id ?? "");
      if (poda) window.clearTimeout(poda);
      podasPendientes.current.delete(item.id ?? "");
      const [limpio] = aGuardar([item]);
      if (!limpio) return;
      const resultado = await enviar({ ...OPS_VACIAS, crear: [{ idTemporal: item.id ?? "", item: limpio }] });
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      adoptar(resultado.productos, false);
      toast.success(`«${item.name}» vuelve a la carta`);
    },
    [adoptar, enviar],
  );

  /** Borra al momento, con «Deshacer» 6 s. La foto se poda pasado ese tiempo. */
  const eliminar = useCallback(
    async (item: UserPlaceMenuItem) => {
      if (!item.id) return;
      const resultado = await enviar({ ...OPS_VACIAS, borrar: [item.id] });
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      adoptar(resultado.productos, false);
      if (item.image) {
        const id = item.id;
        podasPendientes.current.set(
          id,
          window.setTimeout(() => {
            podasPendientes.current.delete(id);
            pruneMenuImages(place.id, [item], []);
          }, 7000),
        );
      }
      toast.success(`«${item.name || "Producto"}» eliminado`, {
        duration: 6000,
        action: { label: "Deshacer", onClick: () => void restaurar(item) },
      });
    },
    [adoptar, enviar, place.id, restaurar],
  );

  /** Ocultar o mostrar en la ficha, al momento, con su versión. */
  const alternarOculto = useCallback(
    async (item: UserPlaceMenuItem, deshacible = true) => {
      if (!item.id) return;
      const oculto = !item.oculto;
      const resultado = await enviar({
        ...OPS_VACIAS,
        actualizar: [
          {
            id: item.id,
            ...(item.version !== undefined ? { version: item.version } : {}),
            cambios: { oculto },
          },
        ],
      });
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      adoptar(resultado.productos, false);
      if (resultado.conflictos.length > 0) {
        toast.warning("Ese producto cambió desde el móvil. Vuelve a intentarlo con la versión de ahora.");
        return;
      }
      const ahora = resultado.productos.find((p) => p.id === item.id);
      toast.success(oculto ? `«${item.name}» oculto en tu ficha` : `«${item.name}» visible en tu ficha`, {
        action:
          deshacible && ahora
            ? { label: "Deshacer", onClick: () => void alternarOculto(ahora, false) }
            : undefined,
      });
    },
    [adoptar, enviar],
  );

  /** Una acción sobre los seleccionados: una operación por producto. */
  const aplicarLote = useCallback(
    async (cambios: Partial<UserPlaceMenuItem>, texto: string) => {
      if (!seleccion || seleccion.size === 0 || enLote) return;
      setEnLote(true);
      const actualizar = items
        .filter((item) => item.id && seleccion.has(item.id))
        .map((item) => ({
          id: item.id!,
          ...(item.version !== undefined ? { version: item.version } : {}),
          cambios,
        }));
      const resultado = await enviar({ ...OPS_VACIAS, actualizar });
      setEnLote(false);
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      adoptar(resultado.productos, false);
      const hechos = actualizar.length - resultado.conflictos.length;
      if (resultado.conflictos.length > 0) {
        toast.warning(
          `${hechos} ${hechos === 1 ? "producto" : "productos"} ${texto}. ${resultado.conflictos.length} cambiaron desde el móvil y no se tocaron.`,
        );
      } else {
        toast.success(`${hechos} ${hechos === 1 ? "producto" : "productos"} ${texto}`);
      }
      setSeleccion(null);
      setCategoriaLote("");
    },
    [adoptar, enLote, enviar, items, seleccion],
  );

  const alternarSeleccion = (id: string) =>
    setSeleccion((s) => {
      const siguiente = new Set(s ?? []);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const alcanzoTope = tope !== null && items.length >= tope;

  const cambiarModo = (m: "hoy-hay" | "editar") => {
    setModo(m);
    setSeleccion(null);
    /* La URL lo recuerda (`&sub=`), sin remontar la pantalla. */
    const url = new URL(window.location.href);
    url.searchParams.set("sub", m);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className={cn("flex flex-col", seleccion && seleccion.size > 0 && "pb-[92px]")}>
      <h1 className="sr-only">Catálogo</h1>

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

      {/* Sugerencias y no lista cerrada: la categoría la inventa el dueño. */}
      <datalist id={categoriaListId}>
        {categoriasUsadas.map((clave) => (
          <option key={clave} value={clave} />
        ))}
      </datalist>

      {/* ── Modo ─────────────────────────────────────────────────────────── */}
      <div role="tablist" aria-label="Modo del catálogo" className="flex gap-gap-xs">
        {(
          [
            { id: "hoy-hay", label: "Hoy hay" },
            { id: "editar", label: "Editar carta" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={modo === m.id}
            onClick={() => cambiarModo(m.id)}
            className={clsx(
              "inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border px-gap-md font-lv-display text-small font-semibold transition-colors duration-500 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40 sm:flex-none",
              modo === m.id
                ? TONO_CHAPITA.activa
                : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:text-verde-600",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Buscador y acciones ─────────────────────────────────────────── */}
      <div className="mt-gap-md flex flex-col gap-gap-sm sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/50"
          />
          <Input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, descripción o categoría"
            aria-label="Buscar en el catálogo"
            className={cn(INPUT, "pl-9 font-lv-display")}
          />
        </div>
        {modo === "editar" && (
          <div className="flex flex-wrap items-center gap-gap-sm">
            <button
              type="button"
              onClick={() => setMostrarImport((v) => !v)}
              aria-expanded={mostrarImport}
              className={cn(
                BOTON,
                "bg-white border border-ink/10 text-ink hover:border-verde-300 hover:text-verde-600",
              )}
            >
              <FileUp size={16} strokeWidth={1.8} />
              Importar CSV
            </button>
            <BotonPrimario
              onClick={() => abrirEditor(null)}
              aria-describedby={errorTope ? "catalogo-tope" : undefined}
              disabled={alcanzoTope}
            >
              {alcanzoTope ? <Lock size={16} strokeWidth={1.8} /> : <Plus size={16} strokeWidth={1.8} />}
              Añadir producto
            </BotonPrimario>
          </div>
        )}
      </div>

      {errorTope && (
        <p
          id="catalogo-tope"
          role="alert"
          className="mt-gap-sm rounded-xl border border-amber-200 bg-amber-50 px-3 py-[7px] text-meta font-medium text-ink"
        >
          {errorTope}
        </p>
      )}

      {/* ── Resumen y filtros ───────────────────────────────────────────── */}
      <div className="mt-gap-md flex flex-col gap-gap-sm">
        <div className="flex flex-wrap items-center justify-between gap-gap-sm">
          <p className="text-meta text-ink-soft/75" aria-live="polite">
            {items.length} producto{items.length === 1 ? "" : "s"}
            {tope !== null ? ` de ${tope} — el tope de tu plan` : " en el catálogo"}
          </p>
          {modo === "editar" && items.length > 0 && (
            <BotonTexto onClick={() => setSeleccion((s) => (s ? null : new Set()))}>
              {seleccion ? "Terminar selección" : "Seleccionar varios"}
            </BotonTexto>
          )}
        </div>

        {categorias.length > 0 && (
          <div className="carta-filtros-scroll scrollbar-hide -my-[6px] flex flex-nowrap items-center gap-[6px] overflow-x-auto py-[6px]">
            <Filtro activo={filtro === null} onClick={() => setFiltro(null)} cuenta={items.length}>
              Todas
            </Filtro>
            {agotados > 0 && (
              <Filtro
                activo={filtro === AGOTADOS}
                onClick={() => setFiltro((prev) => (prev === AGOTADOS ? null : AGOTADOS))}
                cuenta={agotados}
              >
                Agotados
              </Filtro>
            )}
            {categorias.map((c) => (
              <Filtro
                key={c.clave}
                activo={filtro === c.clave}
                onClick={() => setFiltro((prev) => (prev === c.clave ? null : c.clave))}
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
            Llegaste a los {tope} productos de tu plan. Para pasar de ahí hay que subir de plan.
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

      {modo === "hoy-hay" && !canHoyHay && bloqueoHoyHay && (
        <TarjetaPanel className="mt-gap-md">
          <div className="flex flex-wrap items-center justify-between gap-gap-sm">
            <p className="font-lv-display text-small font-semibold text-ink">
              Marca lo agotado y lo que vuelve a haber
            </p>
            <Chapita tono="candado">{bloqueoHoyHay}</Chapita>
          </div>
          <CandadoPlan
            onVerPlanes={onVerPlanes}
            texto="Tu carta se ve igual; solo falta poder decir qué se acabó."
          />
        </TarjetaPanel>
      )}

      {/* ── Importación ─────────────────────────────────────────────────── */}
      {mostrarImport && modo === "editar" && (
        <section className="mt-gap-md">
          <div className="mb-gap-sm flex items-center justify-between gap-gap-sm">
            <h2 className="font-lv-display text-body font-semibold text-ink">Importar catálogo</h2>
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
            existentes={items.map((i) => ({ nombre: i.name, categoria: i.category }))}
            /* La importación escribe en la base: al refrescar, la lista se
               vuelve a sembrar con la carta nueva. */
            onCartaCambiada={() => router.refresh()}
            onVolver={() => setMostrarImport(false)}
          />
        </section>
      )}

      {/* ── El catálogo ──────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <EstadoVacio
          titulo="Tu catálogo está vacío"
          texto="Añade tu primer producto —o sube el catálogo entero desde un CSV— y aparecerá en tu ficha y en tu menú público."
          accion={
            <BotonPrimario
              onClick={() => {
                cambiarModo("editar");
                abrirEditor(null);
              }}
            >
              <Plus size={16} strokeWidth={1.8} />
              Añadir producto
            </BotonPrimario>
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
          {grupos.map((grupo, i) => {
            const idGrupo = `catalogo-grupo-${i}`;
            return (
              <section key={grupo.clave} aria-labelledby={idGrupo} className="flex flex-col">
                <h2
                  id={idGrupo}
                  className="mb-gap-xs flex items-baseline gap-gap-xs font-lv-display text-body font-semibold text-ink"
                >
                  {nombreCategoria(grupo.clave)}
                  <span className="text-meta font-medium text-ink-soft/75">{grupo.items.length}</span>
                </h2>
                <ul className="divide-y divide-ink/5 rounded-2xl border border-ink/5 bg-white px-gap-md">
                  {grupo.items.map((item) =>
                    modo === "hoy-hay" ? (
                      <FilaHoyHay
                        key={item.id}
                        item={item}
                        puede={canHoyHay}
                        busy={busyEstado === item.id}
                        masAbierto={masAbierto === item.id}
                        onAlternarMas={() => setMasAbierto((m) => (m === item.id ? null : (item.id ?? null)))}
                        onSet={(estado, hasta) => {
                          setMasAbierto(null);
                          void setEstado(item.id ?? "", estado, hasta);
                        }}
                      />
                    ) : (
                      <FilaCarta
                        key={item.id}
                        item={item}
                        seleccionando={seleccion !== null}
                        seleccionado={Boolean(item.id && seleccion?.has(item.id))}
                        onAbrir={() =>
                          seleccion !== null ? alternarSeleccion(item.id ?? "") : abrirEditor(item)
                        }
                        onMenu={() => {
                          setMenuDe(item);
                          nav.abrirHoja("acciones");
                        }}
                      />
                    ),
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {errorEstado && (
        <div
          role="alert"
          className="mt-gap-md flex flex-wrap items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-destructive"
        >
          <span className="flex-1">{errorEstado}</span>
          <button
            type="button"
            onClick={() => reintentarEstado.current?.()}
            className="rounded-full border border-destructive/25 bg-white px-3 py-[5px] font-semibold text-ink transition-colors duration-300 hover:border-verde-300 hover:text-verde-700"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Barra de la selección múltiple ──────────────────────────────── */}
      {seleccion && seleccion.size > 0 && (
        <div className="sticky bottom-above-nav z-40 mt-gap-lg flex flex-col gap-gap-xs rounded-2xl border border-ink/5 bg-white p-gap-sm shadow-card lg:bottom-4">
          <p className="font-lv-display text-meta font-semibold text-ink">
            {seleccion.size} {seleccion.size === 1 ? "seleccionado" : "seleccionados"}
          </p>
          <div className="scrollbar-hide flex gap-gap-xs overflow-x-auto">
            {canHoyHay && (
              <>
                <BotonSecundario
                  className="shrink-0"
                  disabled={enLote}
                  onClick={() => void aplicarLote({ disponibilidad: "agotado", agotadoHasta: null }, "marcados como agotados")}
                >
                  Agotar
                </BotonSecundario>
                <BotonSecundario
                  className="shrink-0"
                  disabled={enLote}
                  onClick={() => void aplicarLote({ disponibilidad: "disponible", agotadoHasta: null }, "marcados como disponibles")}
                >
                  Disponible
                </BotonSecundario>
              </>
            )}
            <BotonSecundario
              className="shrink-0"
              disabled={enLote}
              onClick={() => void aplicarLote({ oculto: true }, "ocultos en tu ficha")}
            >
              Ocultar
            </BotonSecundario>
            <BotonSecundario
              className="shrink-0"
              disabled={enLote}
              onClick={() => void aplicarLote({ oculto: false }, "visibles en tu ficha")}
            >
              Mostrar
            </BotonSecundario>
          </div>
          <div className="flex gap-gap-xs">
            <input
              type="text"
              value={categoriaLote}
              list={categoriaListId}
              onChange={(e) => setCategoriaLote(e.target.value)}
              placeholder="Nueva categoría"
              aria-label="Nueva categoría para los seleccionados"
              className={cn(INPUT, "min-w-0 flex-1")}
            />
            <BotonSecundario
              className="shrink-0"
              disabled={enLote || !categoriaLote.trim()}
              onClick={() =>
                void aplicarLote({ category: categoriaLote.trim() }, `movidos a «${categoriaLote.trim()}»`)
              }
            >
              Cambiar categoría
            </BotonSecundario>
          </div>
        </div>
      )}

      {/* ── Hoja: editar o añadir un producto ───────────────────────────── */}
      <HojaPanel
        open={nav.hoja === "producto" && edicion !== null}
        onOpenChange={(open) => {
          if (!open) cerrarEditor();
        }}
        titulo={edicion?.original ? "Editar producto" : "Nuevo producto"}
      >
        {edicion && (
          <div className="flex flex-col gap-gap-sm">
            {edicion.conflicto !== undefined && (
              <div
                role="status"
                className="flex flex-wrap items-center gap-gap-sm rounded-xl border border-lv-amber/40 bg-lv-amber/10 px-3 py-[7px] text-meta font-medium text-ink"
              >
                <span className="min-w-0 flex-1">
                  {edicion.conflicto === null
                    ? "Este producto se borró desde el móvil mientras lo editabas."
                    : "Este producto cambió desde el móvil mientras lo editabas. Guarda otra vez para quedarte con lo tuyo, o carga lo de ahora."}
                </span>
                <button
                  type="button"
                  onClick={recargarProducto}
                  className="cursor-pointer font-lv-display font-semibold text-verde-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
                >
                  {edicion.conflicto === null ? "Cerrar" : "Cargar lo de ahora"}
                </button>
              </div>
            )}
            <FilaProducto
              item={edicion.draft}
              recienCreado={!edicion.original}
              subiendo={subiendoId === edicion.draft.id}
              canHoyHay={canHoyHay}
              persistido={Boolean(edicion.original)}
              busyEstado={busyEstado === edicion.draft.id}
              listaCategorias={categoriaListId}
              categoriasUsadas={categoriasUsadas}
              sinNombre={Boolean(errorProducto) && !edicion.draft.name.trim()}
              configTasa={configTasa}
              onPatch={patchDraft}
              onEliminar={() => {
                const original = edicion.original;
                setEdicion(null);
                nav.cerrarHoja();
                if (original) void eliminar(original);
              }}
              onElegirFoto={elegirFoto}
              onSetEstado={(id, estado, hasta) => void setEstado(id, estado, hasta)}
            />
            {errorProducto && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-ink"
              >
                {errorProducto}
              </p>
            )}
            <BotonPrimario
              alto="lg"
              className="w-full"
              disabled={guardandoProducto || Boolean(subiendoId)}
              onClick={() => void guardarProducto()}
            >
              {guardandoProducto ? (
                <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
              ) : (
                <Save size={16} strokeWidth={1.8} />
              )}
              {guardandoProducto ? "Guardando…" : edicion.original ? "Guardar producto" : "Añadir a la carta"}
            </BotonPrimario>
          </div>
        )}
      </HojaPanel>

      {/* ── Hoja: «⋯» de un producto ────────────────────────────────────── */}
      <HojaPanel
        open={nav.hoja === "acciones" && menuDe !== null}
        onOpenChange={(open) => {
          if (!open) nav.cerrarHoja();
        }}
        titulo={menuDe?.name || "Producto"}
      >
        {menuDe && (
          <div className="flex flex-col gap-gap-xs">
            <BotonSecundario className="w-full !justify-start" onClick={() => abrirEditor(menuDe)}>
              <Pencil size={16} strokeWidth={1.8} />
              Editar
            </BotonSecundario>
            {conOfertas && menuDe.id && !menuDe.oculto && !estaAgotado(menuDe) && (
              <BotonSecundario
                className="w-full !justify-start"
                onClick={() => {
                  setOfertaDe(menuDe.id ?? null);
                  nav.abrirHoja("oferta");
                }}
              >
                <Tag size={16} strokeWidth={1.8} />
                Poner en oferta
              </BotonSecundario>
            )}
            {menuDe.id && nav.puedeAbrir({ seccion: "publicaciones", sub: null }) && (
              <BotonSecundario
                className="w-full !justify-start"
                onClick={() => nav.ir({ seccion: "publicaciones", sub: null }, { producto: menuDe.id ?? "" })}
              >
                <Megaphone size={16} strokeWidth={1.8} />
                Publicar en Facebook
              </BotonSecundario>
            )}
            <BotonSecundario
              className="w-full !justify-start"
              onClick={() => {
                const item = menuDe;
                nav.cerrarHoja();
                void alternarOculto(item);
              }}
            >
              {menuDe.oculto ? <Eye size={16} strokeWidth={1.8} /> : <EyeOff size={16} strokeWidth={1.8} />}
              {menuDe.oculto ? "Mostrar en la ficha" : "Ocultar de la ficha"}
            </BotonSecundario>
            <BotonSecundario
              className="w-full !justify-start !text-destructive"
              onClick={() => {
                const item = menuDe;
                nav.cerrarHoja();
                void eliminar(item);
              }}
            >
              <Trash2 size={16} strokeWidth={1.8} />
              Eliminar
            </BotonSecundario>
          </div>
        )}
      </HojaPanel>

      {conOfertas && (
        <HojaPanel
          open={nav.hoja === "oferta" && ofertaDe !== null}
          onOpenChange={(open) => {
            if (!open) nav.cerrarHoja();
          }}
          titulo="Poner en oferta"
          descripcion="Sale en tu ficha y en tu carta con el precio tachado."
        >
          {ofertaDe && (
            <OfertaRapida
              key={ofertaDe}
              place={place}
              funciones={funciones}
              productoInicial={ofertaDe}
              onHecho={nav.cerrarHoja}
            />
          )}
        </HojaPanel>
      )}
    </div>
  );
}

/** Una fila de «Hoy hay»: nombre, categoría y precio, y el interruptor. */
function FilaHoyHay({
  item,
  puede,
  busy,
  masAbierto,
  onAlternarMas,
  onSet,
}: {
  item: UserPlaceMenuItem;
  puede: boolean;
  busy: boolean;
  masAbierto: boolean;
  onAlternarMas: () => void;
  onSet: (estado: Disponibilidad, hasta?: number | null) => void;
}) {
  const agotado = estaAgotado(item);
  const nombre = item.name || "Producto sin nombre";
  return (
    <li className="py-gap-xs">
      <div className="flex min-h-11 items-center gap-gap-sm">
        <div className="min-w-0 flex-1">
          <p className="truncate font-lv-display text-small font-semibold text-ink">{nombre}</p>
          <p className="truncate text-meta text-ink-soft/75">
            {[item.category, item.price ? `${item.price} ${item.currency}` : null]
              .filter(Boolean)
              .join(" · ")}
            {agotado && item.agotadoHasta ? " · vuelve mañana" : ""}
            {item.oculto ? " · oculto" : ""}
          </p>
        </div>
        <span
          className={clsx(
            "shrink-0 font-lv-display text-meta font-semibold",
            agotado ? "text-ink-soft/75" : "text-verde-700",
          )}
        >
          {agotado ? "Agotado" : "Hay"}
        </span>
        {puede && (
          <>
            <Switch
              checked={!agotado}
              disabled={busy}
              label={`${nombre}: ${agotado ? "agotado" : "hay"}`}
              onToggle={() => onSet(agotado ? "disponible" : "agotado")}
            />
            <BotonIcono
              aria-label={`Más opciones de ${nombre}`}
              aria-expanded={masAbierto}
              onClick={onAlternarMas}
            >
              <Ellipsis size={18} strokeWidth={1.8} />
            </BotonIcono>
          </>
        )}
      </div>
      {puede && masAbierto && (
        <div className="flex flex-wrap gap-gap-xs pb-gap-xs">
          <BotonSecundario disabled={busy} onClick={() => onSet("agotado", hastaManana())}>
            Agotado hasta mañana
          </BotonSecundario>
        </div>
      )}
    </li>
  );
}

/** Una fila de «Editar carta»: miniatura, datos y «⋯». Tocarla abre la hoja. */
function FilaCarta({
  item,
  seleccionando,
  seleccionado,
  onAbrir,
  onMenu,
}: {
  item: UserPlaceMenuItem;
  seleccionando: boolean;
  seleccionado: boolean;
  onAbrir: () => void;
  onMenu: () => void;
}) {
  const nombre = item.name || "Producto sin nombre";
  return (
    <li className="flex items-center gap-gap-sm py-gap-xs">
      <button
        type="button"
        onClick={onAbrir}
        aria-pressed={seleccionando ? seleccionado : undefined}
        className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-gap-sm rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
      >
        {seleccionando && (
          <input
            type="checkbox"
            checked={seleccionado}
            readOnly
            tabIndex={-1}
            aria-hidden
            className="size-5 shrink-0 accent-verde-500"
          />
        )}
        <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink/5 bg-sand text-verde-400">
          {item.image ? (
            <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />
          ) : (
            <ImageIcon size={18} strokeWidth={1.8} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-lv-display text-small font-semibold text-ink">{nombre}</span>
          <span className="block truncate text-meta text-ink-soft/75">
            {item.price ? `${item.price} ${item.currency}` : "Sin precio"}
            {item.description ? ` · ${item.description}` : ""}
          </span>
        </span>
        {item.oculto && <Chapita tono="neutra">Oculto</Chapita>}
        {estaAgotado(item) && <Chapita tono="ambar">Agotado</Chapita>}
      </button>
      {!seleccionando && (
        <BotonIcono aria-label={`Más opciones de ${nombre}`} onClick={onMenu}>
          <Ellipsis size={18} strokeWidth={1.8} />
        </BotonIcono>
      )}
    </li>
  );
}

/**
 * Una fila del catálogo.
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
  categoriasUsadas,
  sinNombre,
  configTasa = null,
  conflicto = false,
  onRecargar,
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
  /** Categorías ya usadas, para ofrecerlas como pastillas donde `datalist` no llega. */
  categoriasUsadas: string[];
  /** Sin nombre: se marca en rojo para que el aviso de guardar diga cuál es. */
  sinNombre: boolean;
  configTasa?: ConfigTasa | null;
  /** Otro cambió este producto mientras el panel estaba abierto. */
  conflicto?: boolean;
  onRecargar?: (id: string) => void;
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
  /* Con el campo de categoría enfocado se ofrecen las que ya existen en
     pastillas. Es el camino que sí existe en Safari de iOS, donde `datalist` no
     pinta nada: sin esto, el campo se quedaba sin sugerencias justo en el
     navegador que más se usa aquí. */
  const [sugiriendo, setSugiriendo] = useState(false);

  /** Vuelca lo escrito, ya recortado —que es como lo deja `aGuardar`— para que
      el campo y lo guardado no se separen tras un guardado. */
  const commitCategoria = () => {
    const limpia = categoria.trim();
    setCategoria(limpia);
    if (limpia !== (item.category ?? "")) onPatch(id, { category: limpia });
  };

  /** Elige una categoría existente desde las pastillas. */
  const elegirCategoria = (clave: string) => {
    setCategoria(clave);
    setSugiriendo(false);
    if (clave !== (item.category ?? "")) onPatch(id, { category: clave });
  };

  return (
    <div className="group flex flex-wrap scroll-mt-[88px] items-start gap-gap-sm border-b border-ink/5 py-gap-sm last:border-b-0">
      {/* Otro lo cambió mientras el panel estaba abierto: el guardado no lo
          pisó. El dueño decide si se queda con lo suyo (vuelve a guardar) o
          carga lo que hay en la base. */}
      {conflicto && (
        <div
          role="status"
          className="flex basis-full flex-wrap items-center gap-gap-sm rounded-xl border border-lv-amber/40 bg-lv-amber/10 px-3 py-[7px] text-meta font-medium text-ink"
        >
          <span className="min-w-0 flex-1">Este producto cambió desde el móvil.</span>
          <button
            type="button"
            onClick={() => onRecargar?.(id)}
            className="cursor-pointer font-lv-display font-semibold text-verde-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
          >
            Recargar este producto
          </button>
        </div>
      )}
      <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border border-ink/5 transition-colors duration-500 ease-outquint group-hover:border-verde-300 sm:size-16">
        <button
          type="button"
          onClick={() => onElegirFoto(id)}
          disabled={subiendo}
          aria-label={
            item.image
              ? `Cambiar la foto de ${nombre}`
              : `Añadir foto a ${nombre}`
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
            /* Siempre visible: en el móvil no hay `hover`, y con la X escondida
               quitar una foto era imposible desde el teléfono, que es donde se
               trabaja. */
            className="absolute right-[4px] top-[4px] z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-ink/70 text-white transition-colors duration-500 ease-outquint hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X size={12} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-gap-xs">
        <Input
          type="text"
          value={item.name}
          autoFocus={recienCreado}
          onChange={(e) => onPatch(id, { name: e.target.value })}
          placeholder="Nombre del producto o servicio"
          aria-label="Nombre del producto"
          aria-invalid={sinNombre || undefined}
          className={cn(
            INPUT,
            "font-semibold",
            /* Sin nombre se marca aquí y no solo en el aviso de abajo: el ojo
               tiene que encontrar la fila sola. */
            sinNombre && "border-destructive/40 bg-destructive/5",
          )}
        />
        <Input
          type="text"
          value={item.description}
          onChange={(e) => onPatch(id, { description: e.target.value })}
          placeholder="Descripción breve"
          aria-label="Descripción del producto"
          className={cn(INPUT, "text-ink-soft/75 sm:text-meta")}
        />
        {/* `flex-wrap` para que la etiqueta caiga abajo cuando no quepa, en vez
            de empujar la fila fuera de la tarjeta en el móvil. Y `shrink-0` en
            todo: sin él los campos encogían —`min-w-0` y `shrink` por defecto—
            en vez de envolver, y en el móvil los tres se aplastaban en un solo
            renglón ilegible. Envolviendo, cada uno conserva su ancho. */}
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
            onFocus={() => setSugiriendo(true)}
            onBlur={() => {
              commitCategoria();
              setSugiriendo(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder="Categoría"
            list={listaCategorias}
            aria-label="Categoría del producto"
            className={cn(
              INPUT,
              "w-[124px] shrink-0 sm:w-[148px] sm:text-meta",
            )}
          />
          {/* Precio y moneda envuelven como una sola pieza: es lo pedido —la
              moneda pegada al precio, a su derecha— y en el móvil es lo que
              impide que el salto de línea los separe en dos renglones
              distintos. La moneda no lleva `INPUT` a propósito: ese trae
              `w-full`, y un ancho de campo completo en esta fila (`flex-wrap`)
              le daba un renglón propio con solo la etiqueta más larga. */}
          <div className="flex shrink-0 flex-col gap-[2px]">
            <div className="flex items-center gap-gap-xs">
            <Input
              type="text"
              value={item.price}
              /* Se limpia lo que se escribe: el precio solo puede ser número, y
                 un carácter suelto de más viajaba hasta la carta pública. */
              onChange={(e) =>
                onPatch(id, { price: limpiarPrecio(e.target.value) })
              }
              inputMode="decimal"
              placeholder="0"
              aria-label="Precio"
              className={cn(INPUT, "w-[64px] font-lv-display sm:w-[80px]")}
            />
            {/* El `Select` del sistema y no un `<select>` nativo: en la misma
                fila convive con los campos de arriba y un desplegable del
                navegador se lee como de otra aplicación. */}
            <Select
              value={item.currency}
              onValueChange={(valor) => onPatch(id, { currency: valor })}
            >
              <SelectTrigger
                aria-label="Moneda del producto"
                className="h-11 w-auto shrink-0 gap-[6px] px-gap-xs font-lv-display text-body sm:text-small"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* El rótulo dice la sigla **y** el nombre de la calle: «USD
                    Clásica» solo, junto a un «USD» a secas, es una trampa para
                    elegir la moneda equivocada. */}
                <SelectItem value="MLC">MLC · USD Clásica</SelectItem>
                <SelectItem value="CUP">CUP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
            </div>
            {/* Preview conversión en vivo */}
            {configTasa && (() => {
              const { secundario } = preciosDeItem(item, configTasa);
              if (secundario) {
                return (
                  <span className="text-[13px] tabular-nums text-muted-foreground leading-none">
                    = {secundario}
                  </span>
                );
              }
              if (item.price.trim() && (item.currency === "USD" || item.currency === "MLC" || item.currency === "CUP")) {
                return (
                  <span className="text-[11px] text-muted-foreground leading-none">
                    Escribe solo el número para ver el cambio
                  </span>
                );
              }
              return null;
            })()}
            {/* Un precio que no es una cifra («100-400», «1.200») se enseña tal
                cual, pero el carrito no puede sumarlo: el pedido llega sin
                total. Se avisa aquí, donde se escribe. */}
            {item.price.trim() &&
              convertirPrecio(item.price, item.currency).precio === null && (
                <details className="max-w-[220px] text-[11px] leading-snug text-ink-soft/75">
                  <summary className="cursor-pointer select-none font-medium">
                    Este precio no se suma en el carrito
                  </summary>
                  <span className="mt-[2px] block">
                    Escribe solo una cifra, por ejemplo «3.50», para que el
                    pedido calcule el total. Un rango o un texto se enseña igual,
                    pero no suma.
                  </span>
                </details>
              )}
          </div>
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
          {/* Las categorías ya usadas, en pastillas, mientras el campo tiene el
              foco. Es el camino que sí existe en Safari de iOS, donde
              `datalist` no pinta nada: sin esto, el campo se quedaba sin
              sugerencias en el navegador que más se usa aquí. */}
          {sugiriendo && categoriasUsadas.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-[6px]">
              {categoriasUsadas.map((clave) => (
                <button
                  key={clave}
                  type="button"
                  /* El `mousedown` se cancela para que el campo no pierda el
                     foco antes del clic: si no, `onBlur` cerraría la fila de
                     pastillas justo antes de poder pulsar una. */
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegirCategoria(clave)}
                  className="cursor-pointer rounded-full border border-ink/10 bg-sand px-[10px] py-[3px] font-lv-display text-[11px] font-medium text-ink-soft/75 transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
                >
                  {clave}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* La columna de acciones, a la derecha y fuera de la de campos: son
          acciones sobre el producto, no datos suyos. La papelera arriba y «Hoy
          hay» debajo, con 12 px de aire: los dos blancos miden 44 px y el pulgar
          pasa por aquí al hacer scroll. */}
      <div className="flex shrink-0 flex-col items-center gap-gap-sm">
        <button
          type="button"
          onClick={() => onEliminar(id)}
          aria-label={`Eliminar ${nombre}`}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border border-ink/10 text-ink-soft/75 transition duration-500 ease-outquint hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
        >
          {/* Papelera y no una X: la X en esta app significa «cerrar». */}
          <Trash2 size={16} strokeWidth={1.8} />
        </button>
        {/* Ocultar/mostrar el ítem en la ficha pública sin borrarlo. */}
        <button
          type="button"
          onClick={() => onPatch(id, { oculto: !item.oculto })}
          aria-pressed={item.oculto}
          aria-label={item.oculto ? `Mostrar ${nombre}` : `Ocultar ${nombre}`}
          title={item.oculto ? "Mostrar en la ficha" : "Ocultar de la ficha"}
          className={cn(
            "grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border transition duration-500 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
            item.oculto
              ? "border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100"
              : "border-ink/10 text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
          )}
        >
          {item.oculto ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
        </button>
        {canHoyHay && persistido && (
          <AvailabilityControl
            item={item}
            busy={busyEstado}
            onSet={(estado, hasta) => void onSetEstado(id, estado, hasta)}
          />
        )}
      </div>
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
        /* Alto fijo y `items-center` —40 px, el mínimo del sistema para un chip—
           para que la fila no se escalone cuando una categoría trae un nombre
           largo; `shrink-0` y `whitespace-nowrap` porque la fila ya no
           envuelve: si la pastilla se encogiera, el nombre partiría en dos
           líneas dentro de una pastilla más baja que sus vecinas. */
        "inline-flex h-10 shrink-0 cursor-pointer select-none items-center whitespace-nowrap rounded-full border px-[14px] font-lv-display text-meta font-medium transition duration-500 ease-outquint active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40 focus-visible:ring-offset-2",
        activo
          ? "border-verde-400 bg-verde-400 text-verde-950 shadow-soft"
          : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
      )}
    >
      {children}
      <span
        className={cn(
          "ml-[6px]",
          /* El contador también es texto: a `/50` sobre blanco se quedaba en
             3,1:1 y con sol en la puerta no se lee. */
          activo ? "text-verde-950" : "text-ink-soft/75",
        )}
      >
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
    <div
      /* Se anuncia al aparecer: cuando el filtro deja la lista vacía, el aviso
         es justo lo que hay que decir y sin esto el cambio era mudo. */
      role="status"
      className="mt-gap-lg flex flex-col items-center gap-gap-sm rounded-2xl border border-dashed border-ink/10 bg-white/60 px-gap-lg py-gap-xl text-center"
    >
      <h2 className="font-lv-display text-body font-semibold text-ink">
        {titulo}
      </h2>
      <p className="max-w-[42ch] text-small text-ink-soft/75">{texto}</p>
      {accion}
    </div>
  );
}

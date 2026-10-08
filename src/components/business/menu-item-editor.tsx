"use client";

import { useState, useCallback, useId, useRef } from "react";
import Image from "next/image";
import { Clock, Image as ImageIcon, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareImage } from "@/lib/storage/compress";
import {
  estaAgotado,
  hastaManana,
  type Disponibilidad,
} from "@/lib/disponibilidad";

interface MenuItemData {
  id: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  tag?: string;
  /** Familia del producto («Entrantes», «Bebidas»). Ver `UserPlaceMenuItem`. */
  category?: string;
  gradient?: string;
  /** URL de la foto en el bucket, **una sola** por producto. Vacío = sin foto. */
  image?: string;
  /** «Hoy hay»: estado guardado del producto. Ver `disponibilidad.ts`. */
  disponibilidad?: Disponibilidad;
  agotadoHasta?: number | null;
}

interface MenuItemEditorProps {
  items?: MenuItemData[];
  onChange?: (items: MenuItemData[]) => void;
  /**
   * Negocio al que cuelga la foto: la subida va a `/api/places/[id]/menu-image`
   * y esa ruta exige que la ficha exista. `null` en el alta nueva del
   * administración, que todavía no tiene id — el mismo caso que `PhotoGrid`,
   * que avisa de que hay que guardar primero.
   */
  placeId?: string | null;
  /** «Hoy hay» solo entra desde Básico. Sin esto no se pintan los controles. */
  canHoyHay?: boolean;
  className?: string;
}

const DEFAULT_ITEMS: MenuItemData[] = [
  { id: "1", name: "Ropa Vieja de Res", description: "Carne deshilachada con sofrito cubano, arroz y plátanos", price: "12", currency: "MLC", tag: "Popular", gradient: "linear-gradient(135deg, #EAF7EF, #CEEEDB)" },
  { id: "2", name: "Lechón Asado", description: "Cerdo asado lentamente con mojo criollo, yuca y ensalada", price: "15", currency: "MLC", gradient: "linear-gradient(135deg, #CEEEDB, #EAF7EF)" },
  { id: "3", name: "Mojito de la Casa", description: "Ron fresco, hierbabuena, lima y soda. Receta de la casa.", price: "5", currency: "MLC", tag: "2x1", gradient: "linear-gradient(135deg, #F6F3EC, #EAE4D6)" },
];

/* Mismo mapa de etiquetas que usa la tarjeta de lugar del home: el distintivo
   verde para lo destacado, arena para el resto. Antes eran ámbar y rojo, que no
   existen en el sistema. */
const TAG_STYLES: Record<string, string> = {
  Popular: "bg-verde-100 text-verde-700",
  Nuevo: "bg-verde-50 text-verde-600",
  "2x1": "bg-sand-deep text-ink-soft/75",
};

const INPUT =
  "px-gap-sm border rounded-xl font-lv text-small bg-white text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

/* Botón pequeño de «Hoy hay»: misma familia que el resto del editor, en tamaño
   de utilidad porque va dentro de la fila de un producto. */
const AVAIL_BTN =
  "inline-flex items-center gap-[4px] rounded-full border border-ink/10 bg-white px-[10px] py-[4px] " +
  "font-lv-display text-[11px] font-medium text-ink-soft/75 transition-colors duration-500 ease-outquint " +
  "hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

/**
 * El control de disponibilidad de un producto.
 *
 * Enseña el estado **efectivo** —un producto agotado cuya fecha de vuelta ya
 * pasó se lee como disponible— y ofrece las dos acciones rápidas: alternar y
 * «hasta mañana». El estado tarda en confirmarse contra el servidor, así que el
 * botón se desactiva mientras tanto en vez de dejar pulsar dos veces.
 */
function AvailabilityControl({
  item,
  busy,
  onSet,
}: {
  item: MenuItemData;
  busy: boolean;
  onSet: (estado: Disponibilidad, hasta?: number | null) => void;
}) {
  const agotado = estaAgotado(item);
  return (
    <div className="mt-gap-xs flex flex-wrap items-center gap-gap-xs">
      <span
        className={cn(
          "inline-flex items-center rounded-full px-[10px] py-[3px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em]",
          agotado ? "bg-destructive/10 text-destructive" : "bg-verde-50 text-verde-600",
        )}
      >
        {agotado ? "Agotado" : "Disponible"}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => onSet(agotado ? "disponible" : "agotado")}
        className={AVAIL_BTN}
      >
        {busy && <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />}
        {agotado ? "Marcar disponible" : "Marcar agotado"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onSet("agotado", hastaManana())}
        className={AVAIL_BTN}
      >
        <Clock size={13} strokeWidth={1.8} />
        Hasta mañana
      </button>
    </div>
  );
}

export function MenuItemEditor({
  items = DEFAULT_ITEMS,
  onChange,
  placeId = null,
  canHoyHay = false,
  className,
}: MenuItemEditorProps) {
  const [menuItems, setMenuItems] = useState(items);
  /* Producto que está subiendo, para girar solo su icono y no toda la lista. */
  const [busyId, setBusyId] = useState<string | null>(null);
  /* Producto cuya disponibilidad se está cambiando ahora mismo. */
  const [estadoBusyId, setEstadoBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /* A qué producto apunta el input: hay **un** selector para la lista entera,
     porque montar uno por fila obligaría a sincronizarlos con `items`. */
  const targetId = useRef<string | null>(null);
  /* Un id por instancia: este editor se monta a la vez en el panel del dueño y
     en el formulario de administración, y dos `datalist` con el mismo id se
     pisan entre sí. */
  const categoryListId = useId();

  /* El `onChange` va fuera del `setState`, y no dentro como estaba en los tres.
     React ejecuta el actualizador durante el render —y dos veces en modo
     estricto—, así que avisar ahí al padre es actualizar otro componente mientras
     se pinta este: «Cannot update a component while rendering a different
     component». El actualizador calcula; el aviso es del clic. */
  /** Aplica un cambio parcial a un producto y avisa al padre. */
  const patch = useCallback(
    (id: string, fields: Partial<MenuItemData>) => {
      const next = menuItems.map((item) => (item.id === id ? { ...item, ...fields } : item));
      setMenuItems(next);
      onChange?.(next);
    },
    [menuItems, onChange],
  );

  const update = useCallback(
    (id: string, field: keyof MenuItemData, value: string) => {
      patch(id, { [field]: value } as Partial<MenuItemData>);
    },
    [patch],
  );

  /**
   * Cambia la disponibilidad de un producto contra el servidor.
   *
   * Va directo a `/api/places/[id]/disponibilidad` en vez de esperar a guardar:
   * el dueño marca «agotado» cuando se le acaba el plato, no al final de un
   * formulario. El servidor decide (comprueba el plan) y aquí se refleja su
   * respuesta; si falla, el estado local no se toca —nada de mentir en pantalla—.
   */
  const setEstado = useCallback(
    async (
      id: string,
      estado: Disponibilidad,
      hasta?: number | null,
    ) => {
      if (!placeId) return;
      setEstadoBusyId(id);
      setError(null);
      try {
        const res = await fetch(`/api/places/${placeId}/disponibilidad`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productoId: id, estado, hasta: hasta ?? null }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "No se pudo cambiar la disponibilidad.");
        }
        patch(id, {
          disponibilidad: estado,
          agotadoHasta: estado === "agotado" ? (hasta ?? null) : null,
        });
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "No se pudo cambiar la disponibilidad.",
        );
      } finally {
        setEstadoBusyId(null);
      }
    },
    [placeId, patch],
  );

  const remove = useCallback(
    (id: string) => {
      const next = menuItems.filter((item) => item.id !== id);
      setMenuItems(next);
      onChange?.(next);
    },
    [menuItems, onChange],
  );

  const add = useCallback(() => {
    const next = [
      ...menuItems,
      {
        id: `new-${Date.now()}`,
        name: "",
        description: "",
        price: "",
        currency: "MLC",
      },
    ];
    setMenuItems(next);
    onChange?.(next);
  }, [menuItems, onChange]);

  /** Abre el selector apuntando a este producto. El cuadrito de imagen no era
      decorativo: era la única forma de añadir la foto y no escuchaba nada. */
  const pick = useCallback(
    (id: string) => {
      if (!placeId) return;
      targetId.current = id;
      setError(null);
      inputRef.current?.click();
    },
    [placeId],
  );

  const upload = useCallback(
    async (file: File | undefined) => {
      const id = targetId.current;
      targetId.current = null;
      if (!file || !id || !placeId) return;

      setBusyId(id);
      setError(null);
      try {
        /* La compresión pasa antes de salir del navegador, igual que en las
           fotos del lugar: lo que llega a la ruta es un WebP de pocos KB. */
        const prepared = await prepareImage(file);
        const form = new FormData();
        form.append("file", prepared.blob, prepared.name);

        const res = await fetch(`/api/places/${placeId}/menu-image`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "No se pudo subir la foto.");
        }
        const created = (await res.json()) as { url: string };
        /* La URL sola es lo que viaja en `places.menu`: el jsonb se lee entero
           en el catálogo y los bytes de la foto vivirían en el bucket. */
        update(id, "image", created.url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
      } finally {
        setBusyId(null);
      }
    },
    [placeId, update],
  );

  /* Se quita de la lista sin esperar al servidor —así responde al dedo— y el
     objeto del bucket no se borra aquí: ver `pruneMenuImages`. Borrarlo en este
     momento dejaría la URL que sigue en la base apuntando a un archivo que ya no
     existe, y la ficha pública enseñaría un hueco roto a quien no vuelva a
     guardar. */
  const removeImage = useCallback(
    (id: string) => {
      const item = menuItems.find((entry) => entry.id === id);
      if (!item?.image) return;
      update(id, "image", "");
    },
    [menuItems, update],
  );

  /* Las categorías que esta carta ya usa, para no teclear «Bebidas» dos veces
     con dos acentos distintos. `Set` conserva el orden de inserción, así que
     salen en el orden en que el dueño fue creando sus grupos, no alfabéticas. */
  const categories = [
    ...new Set(
      menuItems
        .map((item) => item.category?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Mismo aviso que `PhotoGrid` en el alta nueva: sin ficha no hay dónde
          colgar la foto, y el cuadrito sin más dejaría el fallo original —tocar
          la imagen y que no pase nada— en manos de quien está creando el
          negocio. */}
      {!placeId && (
        <p className="text-meta text-ink-soft/75 mb-gap-sm">
          Guarda el negocio primero. En cuanto tenga ficha se le puede poner una
          foto a cada producto.
        </p>
      )}

      {/* Un solo input para toda la lista: `multiple` no, porque cada producto
          lleva una sola imagen. Se vacía para que elegir otra vez el mismo
          archivo vuelva a disparar el `change`. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void upload(file);
        }}
      />

      {/* Sugerencias y no una lista cerrada: la categoría la inventa el dueño
          —una cafetería no agrupa como una ferretería— y esto es un `<datalist>`
          nativo, que filtra según escribe y no cuesta ni una dependencia. */}
      <datalist id={categoryListId}>
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      {menuItems.map((item) => (
        <div
          key={item.id}
          className="group flex gap-gap-sm items-start py-gap-sm border-b border-ink/5 last:border-b-0"
        >
          <div
            className="relative size-14 sm:size-16 rounded-2xl border border-ink/5 overflow-hidden shrink-0 transition-colors duration-500 ease-outquint group-hover:border-verde-300"
            style={item.gradient ? { background: item.gradient } : undefined}
          >
            <button
              type="button"
              onClick={() => pick(item.id)}
              disabled={!placeId || busyId === item.id}
              aria-label={
                item.image
                  ? `Cambiar la foto de ${item.name || "este producto"}`
                  : `Añadir foto a ${item.name || "este producto"}`
              }
              className={cn(
                "absolute inset-0 grid place-items-center text-verde-400 transition-colors duration-500 ease-outquint",
                placeId ? "cursor-pointer hover:bg-ink/5" : "cursor-default",
              )}
            >
              {busyId === item.id ? (
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

            {item.image && busyId !== item.id && (
              <button
                type="button"
                onClick={() => removeImage(item.id)}
                aria-label={`Quitar la foto de ${item.name || "este producto"}`}
                className="absolute top-[4px] right-[4px] z-10 size-5 rounded-full bg-ink/70 text-white grid place-items-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-500 ease-outquint cursor-pointer"
              >
                <X size={12} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-gap-xs min-w-0">
            <input
              type="text"
              value={item.name}
              onChange={(e) => update(item.id, "name", e.target.value)}
              placeholder="Nombre del producto o servicio"
              className={cn(INPUT, "h-10 border-ink/10 font-semibold w-full")}
            />
            <input
              type="text"
              value={item.description}
              onChange={(e) => update(item.id, "description", e.target.value)}
              placeholder="Descripción breve"
              className={cn(INPUT, "h-10 border-ink/10 text-meta text-ink-soft/75 w-full")}
            />
            {/* `min-w-0` en el precio y en el select: sin él los dos se niegan a
                bajar de su ancho intrínseco y la fila se sale de la tarjeta en
                móvil. Con `flex-wrap` la etiqueta cae a la línea de abajo
                cuando no cabe, en vez de empujar. */}
            <div className="flex flex-wrap gap-gap-xs items-center">
              <input
                type="text"
                value={item.category ?? ""}
                onChange={(e) => update(item.id, "category", e.target.value)}
                placeholder="Categoría"
                list={categoryListId}
                aria-label="Categoría del producto"
                className={cn(
                  INPUT,
                  "w-[124px] sm:w-[148px] min-w-0 h-10 border-ink/10 text-meta text-ink-soft/75",
                )}
              />
              <input
                type="text"
                value={item.price}
                onChange={(e) => update(item.id, "price", e.target.value)}
                placeholder="0"
                className={cn(INPUT, "w-[64px] sm:w-[80px] min-w-0 h-10 border-ink/10 font-lv-display")}
              />
              <select
                value={item.currency}
                onChange={(e) => update(item.id, "currency", e.target.value)}
                className={cn(INPUT, "min-w-0 h-10 border-ink/10 font-lv-display text-meta cursor-pointer")}
                aria-label="Moneda del producto"
              >
                <option value="MLC">USD Clásica</option>
                <option value="CUP">CUP</option>
                <option value="USD">USD</option>
              </select>
              {item.tag && (
                <span
                  className={cn(
                    "px-[10px] py-[3px] rounded-full font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em]",
                    TAG_STYLES[item.tag] ?? "bg-sand text-ink-soft/75",
                  )}
                >
                  {item.tag}
                </span>
              )}
            </div>

            {/* «Hoy hay»: solo con el plan que lo incluye. Sin ficha todavía
                (`placeId` nulo) no hay dónde escribirlo. */}
            {placeId && canHoyHay && (
              <AvailabilityControl
                item={item}
                busy={estadoBusyId === item.id}
                onSet={(estado, hasta) => void setEstado(item.id, estado, hasta)}
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => remove(item.id)}
            className="size-9 rounded-full border border-ink/10 grid place-items-center text-ink-soft/75 shrink-0 hover:border-destructive/30 hover:text-destructive hover:bg-destructive/10 transition-all duration-500 ease-outquint"
            aria-label="Eliminar item"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-gap-xs py-gap-sm border border-dashed border-ink/10 rounded-2xl text-ink-soft/75 font-lv-display text-small font-medium cursor-pointer hover:border-verde-300 hover:text-verde-600 hover:bg-verde-50 transition-all duration-500 ease-outquint w-full mt-gap-xs"
      >
        <Plus size={18} strokeWidth={1.8} />
        Añadir producto o servicio
      </button>

      {error && (
        <p
          role="alert"
          className="mt-gap-sm px-3 py-[7px] rounded-xl bg-destructive/10 border border-destructive/25 text-meta text-destructive font-medium"
        >
          {error}
        </p>
      )}
    </div>
  );
}

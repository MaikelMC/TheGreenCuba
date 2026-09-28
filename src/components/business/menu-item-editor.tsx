"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Image as ImageIcon, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareImage } from "@/lib/storage/compress";

interface MenuItemData {
  id: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  tag?: string;
  gradient?: string;
  /** URL de la foto en el bucket, **una sola** por producto. Vacío = sin foto. */
  image?: string;
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

export function MenuItemEditor({
  items = DEFAULT_ITEMS,
  onChange,
  placeId = null,
  className,
}: MenuItemEditorProps) {
  const [menuItems, setMenuItems] = useState(items);
  /* Producto que está subiendo, para girar solo su icono y no toda la lista. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /* A qué producto apunta el input: hay **un** selector para la lista entera,
     porque montar uno por fila obligaría a sincronizarlos con `items`. */
  const targetId = useRef<string | null>(null);

  /* El `onChange` va fuera del `setState`, y no dentro como estaba en los tres.
     React ejecuta el actualizador durante el render —y dos veces en modo
     estricto—, así que avisar ahí al padre es actualizar otro componente mientras
     se pinta este: «Cannot update a component while rendering a different
     component». El actualizador calcula; el aviso es del clic. */
  const update = useCallback(
    (id: string, field: keyof MenuItemData, value: string) => {
      const next = menuItems.map((item) => (item.id === id ? { ...item, [field]: value } : item));
      setMenuItems(next);
      onChange?.(next);
    },
    [menuItems, onChange],
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

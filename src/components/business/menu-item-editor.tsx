"use client";

import { useState, useCallback } from "react";
import { Image, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuItemData {
  id: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  tag?: string;
  gradient?: string;
}

interface MenuItemEditorProps {
  items?: MenuItemData[];
  onChange?: (items: MenuItemData[]) => void;
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
  className,
}: MenuItemEditorProps) {
  const [menuItems, setMenuItems] = useState(items);

  /* El `onChange` va fuera del `setState`, y no dentro como estaba en los tres.
     React ejecuta el actualizador durante el render —y dos veces en modo
     estricto—, así que avisar ahí al padre es actualizar otro componente
     mientras se pinta este: «Cannot update a component while rendering a
     different component». El actualizador calcula; el aviso es del clic. */
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

  return (
    <div className={cn("flex flex-col", className)}>
      {menuItems.map((item) => (
        <div
          key={item.id}
          className="flex gap-gap-sm items-start py-gap-sm border-b border-ink/5 last:border-b-0"
        >
          <div
            className="size-14 sm:size-16 rounded-2xl border border-ink/5 flex items-center justify-center shrink-0 cursor-pointer text-verde-400 transition-colors duration-500 ease-outquint"
            style={item.gradient ? { background: item.gradient } : undefined}
          >
            <Image size={20} strokeWidth={1.8} />
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
    </div>
  );
}

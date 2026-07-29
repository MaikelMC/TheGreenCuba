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
  { id: "1", name: "Ropa Vieja de Res", description: "Carne deshilachada con sofrito cubano, arroz y plátanos", price: "12", currency: "MLC", tag: "Popular", gradient: "linear-gradient(135deg, oklch(75% 0.15 75 / 0.1), oklch(60% 0.20 25 / 0.06))" },
  { id: "2", name: "Lechón Asado", description: "Cerdo asado lentamente con mojo criollo, yuca y ensalada", price: "15", currency: "MLC", gradient: "linear-gradient(135deg, oklch(62% 0.16 145 / 0.08), oklch(70% 0.12 175 / 0.06))" },
  { id: "3", name: "Mojito de la Casa", description: "Ron fresco, hierbabuena, lima y soda. Receta de la casa.", price: "5", currency: "MLC", tag: "2x1", gradient: "linear-gradient(135deg, oklch(62% 0.14 250 / 0.08), oklch(62% 0.16 145 / 0.05))" },
];

const TAG_STYLES: Record<string, string> = {
  Popular: "bg-lv-amber/12 text-lv-amber",
  Nuevo: "bg-accent/10 text-accent",
  "2x1": "bg-destructive/10 text-destructive",
};

export function MenuItemEditor({
  items = DEFAULT_ITEMS,
  onChange,
  className,
}: MenuItemEditorProps) {
  const [menuItems, setMenuItems] = useState(items);

  const update = useCallback(
    (id: string, field: keyof MenuItemData, value: string) => {
      setMenuItems((prev) => {
        const next = prev.map((item) => (item.id === id ? { ...item, [field]: value } : item));
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );

  const remove = useCallback(
    (id: string) => {
      setMenuItems((prev) => {
        const next = prev.filter((item) => item.id !== id);
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );

  const add = useCallback(() => {
    setMenuItems((prev) => {
      const next = [
        ...prev,
        {
          id: `new-${Date.now()}`,
          name: "",
          description: "",
          price: "",
          currency: "MLC",
        },
      ];
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  return (
    <div className={cn("flex flex-col", className)}>
      {menuItems.map((item) => (
        <div
          key={item.id}
          className="flex gap-gap-sm items-start py-gap-sm border-b border-border last:border-b-0"
        >
          <div
            className="size-16 rounded-lv border-2 border-dashed border-border flex items-center justify-center shrink-0 cursor-pointer hover:border-accent hover:text-accent transition-colors"
            style={item.gradient ? { background: item.gradient, borderStyle: "solid", borderColor: "var(--border)" } : undefined}
          >
            <Image size={20} strokeWidth={1.5} />
          </div>

          <div className="flex-1 flex flex-col gap-gap-xs min-w-0">
            <input
              type="text"
              value={item.name}
              onChange={(e) => update(item.id, "name", e.target.value)}
              placeholder="Nombre del plato"
              className="h-9 px-gap-sm border border-border rounded-sm font-body text-small font-semibold bg-surface outline-none focus:border-accent transition-colors w-full"
            />
            <input
              type="text"
              value={item.description}
              onChange={(e) => update(item.id, "description", e.target.value)}
              placeholder="Descripción breve"
              className="h-9 px-gap-sm border border-border rounded-sm font-body text-meta text-muted-foreground bg-surface outline-none focus:border-accent transition-colors w-full"
            />
            <div className="flex gap-gap-xs items-center">
              <input
                type="text"
                value={item.price}
                onChange={(e) => update(item.id, "price", e.target.value)}
                placeholder="0"
                className="w-[80px] h-9 px-gap-sm border border-border rounded-sm font-mono text-small bg-surface outline-none focus:border-accent transition-colors"
              />
              <select
                value={item.currency}
                onChange={(e) => update(item.id, "currency", e.target.value)}
                className="h-9 px-gap-sm border border-border rounded-sm font-mono text-xs bg-surface text-foreground cursor-pointer outline-none focus:border-accent"
              >
                <option value="MLC">MLC</option>
                <option value="CUP">CUP</option>
                <option value="USD">USD</option>
              </select>
              {item.tag && (
                <span
                  className={cn(
                    "px-[8px] py-[2px] rounded-full font-mono text-[10px] uppercase tracking-[0.03em]",
                    TAG_STYLES[item.tag] ?? "bg-muted text-muted-foreground",
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
            className="size-9 rounded-full border border-border grid place-items-center text-muted-foreground shrink-0 hover:border-destructive hover:text-destructive hover:bg-destructive/6 transition-all duration-fast"
            aria-label="Eliminar item"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-gap-xs py-gap-sm border-2 border-dashed border-border rounded-lv text-muted-foreground font-body text-small font-medium cursor-pointer hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-fast w-full mt-gap-xs"
      >
        <Plus size={18} strokeWidth={1.5} />
        Añadir plato o servicio
      </button>
    </div>
  );
}

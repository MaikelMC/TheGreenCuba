"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { usePlaces } from "@/providers/places-provider";
import type { BusinessCategory } from "@/lib/places";
import {
  CategoryIcon,
  CATEGORY_ICON_KEYS,
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_ICON,
} from "@/components/admin/category-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function CategoriasPage() {
  const { categories, places, addCategory, updateCategory, removeCategory } =
    usePlaces();

  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    value: "",
    icon: DEFAULT_CATEGORY_ICON,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setForm({ name: "", value: "", icon: DEFAULT_CATEGORY_ICON });
    setEditingValue(null);
    setFormError(null);
  }, []);

  const startEdit = useCallback((c: BusinessCategory) => {
    setEditingValue(c.value);
    setForm({
      name: c.label,
      value: c.value,
      icon: c.icon ?? DEFAULT_CATEGORY_ICON,
    });
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    const name = form.name.trim();
    if (!name) {
      setFormError("Escribe el nombre de la categoría.");
      return;
    }
    const value = form.value.trim() || slugify(name);

    if (editingValue) {
      updateCategory(editingValue, {
        label: name,
        value,
        icon: form.icon,
      });
      toast.success("Categoría actualizada");
      resetForm();
      return;
    }

    if (categories.some((c) => c.value === value)) {
      setFormError("Ya existe una categoría con ese identificador.");
      return;
    }
    addCategory({
      name,
      value,
      emoji: "📍",
      icon: form.icon,
    });
    toast.success("Categoría agregada");
    resetForm();
  }, [form, editingValue, categories, addCategory, updateCategory, resetForm]);

  const handleDelete = useCallback(
    (c: BusinessCategory) => {
      const used = places.filter((p) => p.category === c.label).length;
      const msg =
        used > 0
          ? `"${c.label}" se usa en ${used} negocios. Los negocios conservarán su nombre de categoría, pero perderán su icono asociado. ¿Eliminar igualmente?`
          : `¿Eliminar la categoría "${c.label}"?`;
      if (!window.confirm(msg)) return;
      removeCategory(c.value);
      toast.success(`Categoría "${c.label}" eliminada`);
      if (editingValue === c.value) resetForm();
    },
    [places, removeCategory, editingValue, resetForm],
  );

  const editing = editingValue !== null;

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-lg">
        <div>
          <h1 className="font-display text-h3 font-bold text-foreground">
            Categorías
          </h1>
          <p className="text-small text-muted-foreground mt-gap-2xs">
            Las categorías disponibles al crear o editar un negocio
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
        {/* List */}
        <div className="bg-surface border border-border rounded-lv-lg p-gap-md">
          <div className="flex flex-col">
            {categories.map((c) => {
              const used = places.filter((p) => p.category === c.label).length;
              return (
                <div
                  key={c.value}
                  className="flex items-center gap-gap-sm py-gap-sm border-b border-border last:border-b-0"
                >
                  <div className="size-9 rounded-lv bg-muted grid place-items-center text-foreground shrink-0">
                    <CategoryIcon icon={c.icon} size={18} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-small font-semibold text-foreground truncate">
                      {c.label}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground truncate">
                      {c.value} · {used} negocio{used === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-[4px]">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="size-9 rounded-lv border border-border grid place-items-center text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                      aria-label={`Editar ${c.label}`}
                    >
                      <Pencil size={15} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="size-9 rounded-lv border border-border grid place-items-center text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                      aria-label={`Eliminar ${c.label}`}
                    >
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <div className="bg-surface border border-border rounded-lv-lg p-gap-md h-fit">
          <div className="flex items-center justify-between mb-gap-sm">
            <h3 className="font-display text-body font-semibold text-foreground">
              {editing ? "Editar categoría" : "Nueva categoría"}
            </h3>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="size-8 rounded-full border border-border grid place-items-center text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                aria-label="Cancelar edición"
              >
                <X size={15} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-gap-sm">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="catName">Nombre</Label>
              <Input
                id="catName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Restaurante"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="catValue">Identificador (opcional)</Label>
              <Input
                id="catValue"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="Auto-generado desde el nombre"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label>Icono</Label>
              <div className="grid grid-cols-6 gap-[6px]">
                {CATEGORY_ICON_KEYS.map((key) => {
                  const Icon = CATEGORY_ICONS[key]!;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, icon: key }))}
                      title={key}
                      className={cn(
                        "size-10 rounded-lv border grid place-items-center transition-all",
                        form.icon === key
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted-foreground hover:border-accent hover:text-accent",
                      )}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-gap-xs mt-gap-xs">
                <span className="text-meta text-muted-foreground">Vista previa:</span>
                <span className="inline-flex items-center gap-2 text-small font-medium text-foreground">
                  <CategoryIcon icon={form.icon} size={18} strokeWidth={1.8} />
                  {form.name || "Nombre de la categoría"}
                </span>
              </div>
            </div>

            {formError && (
              <p className="text-[12px] text-destructive font-medium">
                {formError}
              </p>
            )}

            <Button
              type="button"
              onClick={handleSubmit}
              className="w-full mt-gap-xs"
            >
              <Plus size={18} strokeWidth={1.5} />
              {editing ? "Guardar cambios" : "Agregar categoría"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

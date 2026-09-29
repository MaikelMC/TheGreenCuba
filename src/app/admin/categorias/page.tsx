"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { usePlaces } from "@/providers/places-provider";
import type { BusinessCategory } from "@/lib/places";
import {
  CategoryIcon,
  DEFAULT_CATEGORY_ICON,
} from "@/components/admin/category-icon";
import { IconPicker } from "@/components/ui/icon-picker";
import { cn } from "@/lib/utils";

/* `NFD` descompone los acentos en marcas aparte; `\p{M}` las barre todas, en
   vez de la lista de códigos sueltos que había antes. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\p{M}]/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-small text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";
const ICON_BTN =
  "size-11 sm:size-9 rounded-full border grid place-items-center shrink-0 transition-colors duration-500 ease-outquint";

export default function CategoriasPage() {
  const {
    categories,
    places,
    addCategory,
    updateCategory,
    removeCategory,
    /* Último fallo de escritura que devolvió el servidor. Se pinta junto al
       error del formulario: sin esto, un 409 («no se puede borrar: hay 3
       negocios en esta categoría») se quedaba solo en la consola. */
    error: storeError,
  } = usePlaces();

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

  /* Guardar es ahora un viaje al servidor, así que el `toast` y el `resetForm`
     van después de la respuesta. Antes se cerraba el formulario y se cantaba
     «actualizada» aunque la escritura no hubiera llegado. */
  const handleSubmit = useCallback(async () => {
    const name = form.name.trim();
    if (!name) {
      setFormError("Escribe el nombre de la categoría.");
      return;
    }
    const value = form.value.trim() || slugify(name);

    if (editingValue) {
      const saved = await updateCategory(editingValue, {
        label: name,
        value,
        icon: form.icon,
      });
      if (saved) {
        toast.success("Categoría actualizada");
        resetForm();
      }
      return;
    }

    if (categories.some((c) => c.value === value)) {
      setFormError("Ya existe una categoría con ese identificador.");
      return;
    }
    const created = await addCategory({
      name,
      value,
      emoji: "📍",
      icon: form.icon,
    });
    if (created) {
      toast.success("Categoría agregada");
      resetForm();
    }
  }, [form, editingValue, categories, addCategory, updateCategory, resetForm]);

  const handleDelete = useCallback(
    async (c: BusinessCategory) => {
      const used = places.filter((p) => p.category === c.label).length;
      /* Con negocios dentro la base la rechaza —`places.category_id` es
         `onDelete: restrict`— así que no se pregunta: se dice y ya. Antes el
         aviso prometía que se podía borrar igualmente, y no es verdad. */
      if (used > 0) {
        toast.error(
          used === 1
            ? `No se puede borrar "${c.label}": hay 1 negocio en esa categoría.`
            : `No se puede borrar "${c.label}": hay ${used} negocios en esa categoría.`,
        );
        return;
      }
      if (!window.confirm(`¿Eliminar la categoría "${c.label}"?`)) return;

      if (await removeCategory(c.value)) {
        toast.success(`Categoría "${c.label}" eliminada`);
        if (editingValue === c.value) resetForm();
      }
    },
    [places, removeCategory, editingValue, resetForm],
  );

  const editing = editingValue !== null;

  return (
    <>
      <div className="mb-gap-md">
        <h1 className="sr-only">Categorías</h1>
        <p className="text-small text-ink-soft/75">
          Las categorías disponibles al crear o editar un negocio
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
        {/* List */}
        <div className="bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md">
          <div className="flex flex-col">
            {categories.map((c, i) => {
              const used = places.filter((p) => p.category === c.label).length;
              return (
                <motion.div
                  key={c.value}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  layout
                  className="flex items-center gap-gap-sm py-gap-sm border-b border-ink/5 last:border-b-0"
                >
                  <div className="size-9 rounded-2xl bg-sand grid place-items-center text-verde-600 shrink-0">
                    <CategoryIcon icon={c.icon} size={18} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-lv-display text-small font-semibold text-ink truncate">
                      {c.label}
                    </div>
                    <div className="font-lv-display text-[11px] text-ink-soft/75 truncate">
                      {c.value} · {used} negocio{used === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-[4px]">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => startEdit(c)}
                      className={cn(
                        ICON_BTN,
                        "border-ink/10 text-ink-soft/75 hover:border-verde-300 hover:text-verde-600 hover:bg-verde-50",
                      )}
                      aria-label={`Editar ${c.label}`}
                    >
                      <Pencil size={15} strokeWidth={1.8} />
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDelete(c)}
                      className={cn(
                        ICON_BTN,
                        "border-ink/10 text-ink-soft/75 hover:border-destructive hover:text-destructive hover:bg-destructive/5",
                      )}
                      aria-label={`Eliminar ${c.label}`}
                    >
                      <Trash2 size={15} strokeWidth={1.8} />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md h-fit">
          <div className="flex items-center justify-between mb-gap-sm">
            <h3 className="font-lv-display text-body font-semibold text-ink">
              {editing ? "Editar categoría" : "Nueva categoría"}
            </h3>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="size-11 sm:size-9 rounded-full border border-ink/10 grid place-items-center shrink-0 text-ink-soft/75 hover:border-verde-300 hover:text-verde-600 hover:bg-verde-50 transition-colors duration-500 ease-outquint"
                aria-label="Cancelar edición"
              >
                <X size={15} strokeWidth={1.8} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-gap-sm">
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="catName" className={LABEL}>Nombre</label>
              <input
                id="catName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Restaurante"
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="catValue" className={LABEL}>Identificador (opcional)</label>
              <input
                id="catValue"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="Auto-generado desde el nombre"
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <span className={LABEL}>Icono</span>
              <IconPicker
                value={form.icon}
                onChange={(icon) => setForm((f) => ({ ...f, icon }))}
                label="Icono de categoría"
                preview={form.name || "Nombre de la categoría"}
              />
            </div>

            {formError && (
              <p role="alert" className="text-meta text-destructive font-medium">
                {formError}
              </p>
            )}

            {/* El motivo que devolvió el servidor. Es el único sitio donde se
                ve un 409 de «no se puede borrar» o un fallo de red al guardar. */}
            {storeError && (
              <p role="alert" className="text-meta text-destructive font-medium">
                {storeError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              className="w-full h-11 mt-gap-xs rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98] inline-flex items-center justify-center gap-gap-xs"
            >
              <Plus size={18} strokeWidth={1.8} />
              {editing ? "Guardar cambios" : "Agregar categoría"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

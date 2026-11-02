"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
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

/* El panel se abre animando su propia altura, no con `layout` en las filas.
   Con `layout`, el panel se pintaba ya en su sitio mientras las filas de abajo
   seguían desplazándose: durante un instante parecía caer por debajo de ellas.
   Animando la altura, quien empuja el contenido es el panel y todo se mueve
   junto. `ease-out` quint, la misma curva que el resto del panel. */
const PANEL_MOTION = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: {
    duration: 0.26,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },
};

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

  /* El formulario no vive en una tarjeta aparte: se abre pegado a la fila de
     la categoría que se está editando. Con la tarjeta al lado (o debajo, en
     móvil) el lápiz obligaba a recorrer la lista —y el selector de iconos
     abierto añadía media página más— para llegar a los campos. */
  const [formOpen, setFormOpen] = useState(false);

  const resetForm = useCallback(() => {
    setForm({ name: "", value: "", icon: DEFAULT_CATEGORY_ICON });
    setEditingValue(null);
    setFormError(null);
  }, []);

  const closeForm = useCallback(() => {
    resetForm();
    setFormOpen(false);
  }, [resetForm]);

  const openNew = useCallback(() => {
    resetForm();
    setFormOpen(true);
  }, [resetForm]);

  const startEdit = useCallback((c: BusinessCategory) => {
    setEditingValue(c.value);
    setForm({
      name: c.label,
      value: c.value,
      icon: c.icon ?? DEFAULT_CATEGORY_ICON,
    });
    setFormError(null);
    setFormOpen(true);
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
        closeForm();
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
      icon: form.icon,
    });
    if (created) {
      toast.success("Categoría agregada");
      closeForm();
    }
  }, [form, editingValue, categories, addCategory, updateCategory, closeForm]);

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
        if (editingValue === c.value) closeForm();
      }
    },
    [places, removeCategory, editingValue, closeForm],
  );

  const editing = editingValue !== null;

  /* Un solo bloque para editar y para crear: el de editar se pinta dentro de
     la fila de su categoría, el de crear como primera fila de la lista. Nunca
     hay dos abiertos, así que los `id` de los campos no se repiten. */
  const formPanel = (
    <div className="rounded-xl border border-ink/10 bg-sand/40 p-gap-sm">
      <div className="mb-gap-xs flex items-center justify-between gap-gap-sm">
        <h3 className="font-lv-display text-small font-semibold text-ink">
          {editing ? "Editar categoría" : "Nueva categoría"}
        </h3>
        <button
          type="button"
          onClick={closeForm}
          className="size-9 rounded-full border border-ink/10 bg-white grid place-items-center shrink-0 text-ink-soft/75 hover:border-verde-300 hover:text-verde-600 hover:bg-verde-50 transition-colors duration-500 ease-outquint"
          aria-label="Cerrar formulario"
        >
          <X size={15} strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex flex-col gap-gap-xs">
        {/* Nombre e identificador en dos columnas desde `sm`: el identificador
            casi nunca se toca —se genera solo— y en móvil sigue apilado. */}
        <div className="grid grid-cols-1 gap-gap-xs sm:grid-cols-2">
          <div className="flex flex-col gap-gap-2xs">
            <label htmlFor="catName" className={LABEL}>Nombre</label>
            <input
              id="catName"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Restaurante"
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-gap-2xs">
            <label htmlFor="catValue" className={LABEL}>Identificador</label>
            <input
              id="catValue"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="Opcional, se genera solo"
              className={INPUT}
            />
          </div>
        </div>

        {/* Sin rótulo: la fila plegada ya enseña el icono y el nombre. */}
        <IconPicker
          value={form.icon}
          onChange={(icon) => setForm((f) => ({ ...f, icon }))}
          label="Icono de categoría"
          preview={form.name || "Nombre de la categoría"}
        />

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
          className="mt-gap-2xs w-full h-11 rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition duration-500 ease-outquint active:scale-[0.98] inline-flex items-center justify-center gap-gap-xs"
        >
          <Plus size={18} strokeWidth={1.8} />
          {editing ? "Guardar cambios" : "Agregar categoría"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="mb-gap-md">
        <h1 className="sr-only">Categorías</h1>
        <p className="text-small text-ink-soft/75">
          Las categorías disponibles al crear o editar un negocio
        </p>
      </div>

      <div className="bg-white border border-ink/5 rounded-2xl p-gap-md">
        <div className="flex items-center justify-between gap-gap-sm mb-gap-sm">
          <p className="font-lv-display text-meta font-semibold text-ink-soft/75">
            {categories.length} categoría{categories.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-11 items-center gap-gap-xs rounded-full border border-verde-300 bg-verde-50 px-4 font-lv-display text-small font-semibold text-verde-700 transition-colors duration-500 ease-outquint hover:bg-verde-100 active:scale-[0.98]"
          >
            <Plus size={16} strokeWidth={1.8} />
            Nueva categoría
          </button>
        </div>
        <div className="flex flex-col">
          <AnimatePresence initial={false}>
            {formOpen && !editing && (
              <motion.div key="new" {...PANEL_MOTION} className="overflow-hidden">
                <div className="mb-gap-sm">{formPanel}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {categories.map((c) => {
            const used = places.filter((p) => p.category === c.label).length;
            const open = editingValue === c.value;
            return (
              <div key={c.value} className="border-b border-ink/5 last:border-b-0">
                <div className="flex items-center gap-gap-sm py-gap-sm">
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
                        open
                          ? "border-verde-300 bg-verde-50 text-verde-600"
                          : "border-ink/10 text-ink-soft/75 hover:border-verde-300 hover:text-verde-600 hover:bg-verde-50",
                      )}
                      aria-label={`Editar ${c.label}`}
                      aria-expanded={open}
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
                </div>

                {/* Los campos van dentro de la fila, no en otra tarjeta: tocar
                    el lápiz ya no manda a ninguna parte. */}
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div key="form" {...PANEL_MOTION} className="overflow-hidden">
                      <div className="pb-gap-sm">{formPanel}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

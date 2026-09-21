"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  MapPin,
  Store,
  Send,
  Clock,
  CreditCard,
  Utensils,
  Tag,
  Zap,
  Image as ImageIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { CategoryIcon } from "@/components/admin/category-icon";
import { IconPicker } from "@/components/ui/icon-picker";
import { placeIcon } from "@/lib/places";
import { FormSection } from "@/components/business/form-section";
import { PhotoGrid } from "@/components/business/photo-grid";
import { PaymentChips } from "@/components/business/payment-chips";
import { MenuItemEditor } from "@/components/business/menu-item-editor";
import {
  MapLocationPicker,
  type LocationPoint,
} from "@/components/map/MapLocationPicker";
import { usePlaces } from "@/providers/places-provider";
import type {
  NewUserPlace,
  PlaceStatus,
  UserPlace,
} from "@/lib/places-store";

const SCHEDULE_PRESETS = [
  "8:00 – 16:00",
  "9:00 – 18:00",
  "10:00 – 22:00",
  "12:00 – 24:00",
  "24 horas",
];

const STATUS_OPTIONS: { value: PlaceStatus; label: string }[] = [
  { value: "active", label: "Activo" },
  { value: "closed", label: "Cerrado" },
  { value: "temporary_closed", label: "Temporalmente cerrado" },
];

/* `Input`, `Label` y `Button` viven en `components/ui` con el sistema viejo y
   los usan también `/home` y el diálogo de la landing, que van en su propia
   fase. Aquí se escriben los controles desde el sitio de llamada, como ya
   hacen los chips y las pastillas. */
const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-gap-xs h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none";
const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-gap-xs h-11 px-gap-lg rounded-full border border-ink/10 bg-white text-ink font-lv-display text-small font-semibold hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 transition-all duration-500 ease-outquint active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none";

interface BusinessFormProps {
  initial?: UserPlace;
  onDone: () => void;
}

export function BusinessForm({ initial, onDone }: BusinessFormProps) {
  const router = useRouter();
  const { categories, addPlace, updatePlace } = usePlaces();

  const initialCategoryValue =
    categories.find((c) => c.label === initial?.category)?.value ??
    categories[0]?.value ??
    "restaurante";

  const [name, setName] = useState(initial?.name ?? "");
  const [categoryValue, setCategoryValue] = useState(initialCategoryValue);
  /* `null` = «el de su categoría»: mientras el admin no elija, el pin sigue a la
     categoría. Guardar el vacío y no una copia evita que el icono se quede
     congelado con el de la categoría que estaba puesta al abrir el formulario. */
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null);
  const [barrio, setBarrio] = useState(initial?.barrio ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [schedule, setSchedule] = useState(initial?.schedule ?? "");
  const [payments, setPayments] = useState<string[]>(initial?.payments ?? []);
  const [menu, setMenu] = useState(initial?.menu ?? []);
  const [offerEnabled, setOfferEnabled] = useState(Boolean(initial?.offer));
  const [offerText, setOfferText] = useState(initial?.offer?.text ?? "");
  const [offerExpiry, setOfferExpiry] = useState(initial?.offer?.expiry ?? "");
  const [status, setStatus] = useState<PlaceStatus>(initial?.status ?? "active");
  const [isBoosted, setIsBoosted] = useState(initial?.isBoosted ?? false);
  const [boostExpiresAt, setBoostExpiresAt] = useState(
    initial?.boostExpiresAt ?? "",
  );
  const [location, setLocation] = useState<LocationPoint | null>(
    initial ? { lat: initial.lat, lng: initial.lng } : null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* La etiqueta de la categoría elegida, que es la que indexa el catálogo de
     iconos, y el icono que se enseña: el elegido o el de esa categoría. */
  const categoryLabel =
    categories.find((c) => c.value === categoryValue)?.label ?? "Otro";
  const resolvedIcon = placeIcon(icon ?? undefined, categoryLabel, categories);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Escribe el nombre del negocio.");
      return;
    }
    if (!location) {
      setFormError(
        "Elige el punto del negocio en el mapa: toca el mapa para colocar el pin o usa el botón 'Mi ubicación'.",
      );
      return;
    }
    setFormError(null);
    setSubmitting(true);

    const category =
      categories.find((c) => c.value === categoryValue)?.label ?? "Otro";
    const values: NewUserPlace = {
      name: trimmedName,
      category,
      icon: icon ?? undefined,
      lat: location.lat,
      lng: location.lng,
      address: address.trim(),
      barrio: barrio.trim(),
      description: description.trim(),
      schedule: schedule.trim(),
      payments,
      menu: menu
        .filter((item) => item.name.trim().length > 0)
        .map((item) => ({
          name: item.name,
          description: item.description,
          price: item.price,
          currency: item.currency,
        })),
      offer:
        offerEnabled && offerText.trim()
          ? { text: offerText.trim(), expiry: offerExpiry.trim() }
          : null,
      status,
      isBoosted,
      boostExpiresAt: boostExpiresAt.trim(),
    };

    /* Se espera a la base antes de decir nada. El `toast` de éxito y el cierre
       del panel iban antes de que la escritura llegara: si fallaba la red, el
       usuario veía «guardado» y el negocio desaparecía al recargar. */
    const saved = initial
      ? await updatePlace(initial.id, values)
      : await addPlace(values);

    setSubmitting(false);

    if (!saved) {
      setFormError(
        "No se pudo guardar. Revisa la conexión e inténtalo otra vez: no se cambió nada.",
      );
      return;
    }

    toast.success(
      initial ? "Cambios guardados correctamente" : `"${trimmedName}" se agregó a La Verde`,
    );
    onDone();
  }, [
    name,
    categoryValue,
    categories,
    icon,
    address,
    barrio,
    description,
    schedule,
    payments,
    menu,
    offerEnabled,
    offerText,
    offerExpiry,
    status,
    isBoosted,
    boostExpiresAt,
    location,
    initial,
    addPlace,
    updatePlace,
    onDone,
  ]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="mb-gap-md"
      >
        <h1 className="font-lv-display text-h3 font-bold text-ink">
          {initial ? "Editar negocio" : "Nuevo negocio"}
        </h1>
        <p className="text-small text-ink-soft/75 mt-gap-2xs">
          {initial
            ? `${initial.name} · ${initial.barrio || "Cuba"}`
            : "Agrega un negocio al mapa de La Verde. Funciona en toda Cuba."}
        </p>
      </motion.div>

      <div className="space-y-gap-md">
        {/* Las fotos van primero porque son lo que más pesa en la ficha pública.
            Con el negocio sin guardar no hay `place_id`, así que la rejilla se
            queda en un aviso hasta que exista la ficha. */}
        <FormSection
          title="Fotos del lugar"
          icon={<ImageIcon size={18} strokeWidth={1.8} />}
        >
          <PhotoGrid
            placeId={initial?.id ?? null}
            placeName={name.trim() || "el negocio"}
          />
        </FormSection>

        <FormSection
          title="Información del negocio"
          icon={<Store size={18} strokeWidth={1.8} />}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="bfName" className={LABEL}>Nombre del negocio</label>
              <input
                id="bfName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Paladar El Sabroso"
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="bfCategory" className={LABEL}>Categoría</label>
              <Select value={categoryValue} onValueChange={setCategoryValue}>
                <SelectTrigger id="bfCategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="inline-flex items-center gap-2">
                        <CategoryIcon icon={c.icon} size={16} strokeWidth={1.8} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="bfBarrio" className={LABEL}>Barrio / Municipio</label>
              <input
                id="bfBarrio"
                value={barrio}
                onChange={(e) => setBarrio(e.target.value)}
                placeholder="Ej: Centro histórico, Vista Alegre..."
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="bfAddress" className={LABEL}>Dirección</label>
              <input
                id="bfAddress"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej: Calle 12 #45, entre 7 y 9"
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-gap-xs lg:col-span-2">
              <label htmlFor="bfDesc" className={LABEL}>Descripción</label>
              <textarea
                id="bfDesc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el negocio para que la IA lo recomiende mejor..."
                className={cn(INPUT, "h-auto min-h-[80px] py-3 resize-y leading-relaxed")}
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Horarios"
          icon={<Clock size={18} strokeWidth={1.8} />}
        >
          <div className="flex flex-col gap-gap-sm">
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="bfSchedule" className={LABEL}>Horario de atención</label>
              <input
                id="bfSchedule"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="Ej: 10:00 – 22:00"
                className={INPUT}
              />
            </div>
            <div className="flex flex-wrap gap-[6px]">
              {SCHEDULE_PRESETS.map((preset) => (
                <motion.button
                  key={preset}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setSchedule(preset)}
                  aria-pressed={schedule === preset}
                  className={cn(
                    "px-[14px] py-2 rounded-full border font-lv-display text-meta font-medium cursor-pointer select-none transition-all duration-500 ease-outquint active:scale-[0.98]",
                    schedule === preset
                      ? "border-verde-400 bg-verde-400 text-verde-950 shadow-soft"
                      : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
                  )}
                >
                  {preset}
                </motion.button>
              ))}
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Icono del negocio"
          icon={<CategoryIcon icon={resolvedIcon} size={18} strokeWidth={1.8} />}
        >
          <p className="text-meta text-ink-soft/75 mb-gap-sm">
            El dibujo que lleva este negocio en el pin del mapa, en el popup y en
            su tarjeta. Mientras no elijas uno lleva el de su categoría, y si
            cambias de categoría el icono cambia con ella.
          </p>
          <IconPicker
            value={resolvedIcon}
            onChange={setIcon}
            label="Icono del negocio"
            preview={name.trim() || "Nombre del negocio"}
          />
          {icon !== null && (
            <button
              type="button"
              onClick={() => setIcon(null)}
              className="mt-gap-sm self-start font-lv-display text-meta font-semibold text-verde-600 transition-colors duration-500 ease-outquint hover:text-verde-700 cursor-pointer"
            >
              Usar el de su categoría
            </button>
          )}
        </FormSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
          <FormSection
            title="Métodos de pago"
            icon={<CreditCard size={18} strokeWidth={1.8} />}
          >
            <p className="text-meta text-ink-soft/75 mb-gap-sm">
              Selecciona las monedas y métodos que acepta el negocio. Aparecen en la ficha del lugar.
            </p>
            <PaymentChips
              defaultSelected={initial?.payments ?? []}
              onChange={setPayments}
            />
          </FormSection>

          <FormSection
            title="Oferta especial"
            icon={<Tag size={18} strokeWidth={1.8} />}
          >
            <ToggleRow
              label="Oferta activa"
              hint="Muestra un banner de oferta en la ficha"
              checked={offerEnabled}
              onChange={() => setOfferEnabled((prev) => !prev)}
            />
            <AnimatePresence initial={false}>
              {offerEnabled && (
                <motion.div
                  key="offer-fields"
                  initial={{ opacity: 0, height: 0, y: -4 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -4 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="space-y-gap-xs mt-gap-sm">
                    <div className="flex flex-col gap-gap-xs">
                      <label htmlFor="bfOfferText" className={LABEL}>Texto de la oferta</label>
                      <input
                        id="bfOfferText"
                        value={offerText}
                        onChange={(e) => setOfferText(e.target.value)}
                        placeholder="Ej: 2x1 en bebidas, Almuerzo del día..."
                        className={INPUT}
                      />
                    </div>
                    <div className="flex flex-col gap-gap-xs">
                      <label htmlFor="bfOfferExpiry" className={LABEL}>Válido hasta</label>
                      <input
                        id="bfOfferExpiry"
                        value={offerExpiry}
                        onChange={(e) => setOfferExpiry(e.target.value)}
                        placeholder="Ej: Válido hasta el 30 de septiembre"
                        className={INPUT}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </FormSection>
        </div>

        <FormSection
          title="Menú / Servicios destacados"
          icon={<Utensils size={18} strokeWidth={1.8} />}
        >
          <p className="text-meta text-ink-soft/75 mb-gap-sm">
            Añade los platos o servicios más populares. Aparecen en la ficha del lugar.
          </p>
          <MenuItemEditor
            items={(initial?.menu ?? []).map((m, i) => ({
              ...m,
              id: String(i),
            }))}
            onChange={setMenu}
          />
        </FormSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
          <FormSection
            title="Estado del negocio"
            icon={<Store size={18} strokeWidth={1.8} />}
          >
            <p className="text-meta text-ink-soft/75 mb-gap-sm">
              Controla cómo aparece el negocio en la app pública.
            </p>
            <div className="flex flex-col gap-gap-xs">
              <label htmlFor="bfStatus" className={LABEL}>Estado</label>
              <Select value={status} onValueChange={(v) => setStatus(v as PlaceStatus)}>
                <SelectTrigger id="bfStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormSection>

          <FormSection
            title="Destacar en La Verde"
            icon={<Zap size={18} strokeWidth={1.8} />}
          >
            <ToggleRow
              label="Plan Destacado"
              hint="Pin verde en el mapa, prioridad en recomendaciones IA, badge “Destacado” en la ficha."
              checked={isBoosted}
              onChange={() => setIsBoosted((prev) => !prev)}
            />
            <AnimatePresence initial={false}>
              {isBoosted && (
                <motion.div
                  key="boost-expiry"
                  initial={{ opacity: 0, height: 0, y: -4 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -4 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-gap-xs mt-gap-sm">
                    <label htmlFor="bfBoostExpiry" className={LABEL}>Vigencia del destacado</label>
                    <input
                      id="bfBoostExpiry"
                      value={boostExpiresAt}
                      onChange={(e) => setBoostExpiresAt(e.target.value)}
                      placeholder="Ej: 31 de agosto, 2026"
                      className={INPUT}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </FormSection>
        </div>

        <FormSection
          title="Ubicación en el mapa"
          icon={<MapPin size={18} strokeWidth={1.8} />}
        >
          <p className="text-meta text-ink-soft/75 mb-gap-sm">
            Escribe la dirección (ej: Calle Heredia e/ San Pedro y Santo Tomás), elige la
            coincidencia y ajusta el pin en el mapa. El punto cae sobre la calle, no al lado.
          </p>
          <MapLocationPicker
            value={location}
            onChange={setLocation}
            onResolved={(r) => {
              if (!r) return;
              // No pisa una dirección escrita con entre-calles ("e/ A y B").
              setAddress((prev) =>
                prev.trim() === "" || !/e\/|entre/i.test(prev)
                  ? r.address
                  : prev,
              );
              setBarrio((prev) => (prev.trim() ? prev : r.barrio));
            }}
          />
        </FormSection>

        <AnimatePresence>
          {formError && (
            <motion.div
              key="bf-error"
              role="alert"
              initial={{ opacity: 0, y: -8, x: -4 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="px-3 py-[7px] rounded-xl bg-destructive/10 border border-destructive/25 text-meta text-destructive font-medium"
            >
              {formError}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col lg:flex-row gap-gap-sm">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={submitting}
            className={BTN_OUTLINE}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={cn(BTN_PRIMARY, "w-full lg:w-auto")}
          >
            <Send size={16} strokeWidth={1.8} />
            {submitting
              ? "Guardando..."
              : initial
                ? "Guardar cambios"
                : "Agregar negocio"}
          </button>
        </div>
      </div>
    </>
  );
}

/* Fila con interruptor. Se repetía dos veces —oferta y destacado— con el mismo
   marcado; solo cambiaban el texto y el estado que mueve. */
function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-gap-sm border-b border-ink/5 gap-gap-sm">
      <div className="flex-1 min-w-0">
        <div className="font-lv-display text-small font-medium text-ink">{label}</div>
        <div className="text-meta text-ink-soft/75">{hint}</div>
      </div>
      <button
        type="button"
        onClick={onChange}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn(
          "w-[48px] h-[28px] rounded-full relative cursor-pointer border-none p-0 transition-colors duration-500 ease-outquint shrink-0",
          checked ? "bg-verde-400" : "bg-ink/10",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cn(
            "absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow-soft",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

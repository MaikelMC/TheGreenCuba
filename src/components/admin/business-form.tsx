"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/admin/category-icon";
import { FormSection } from "@/components/business/form-section";
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

  const handleSubmit = useCallback(() => {
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

    if (initial) {
      updatePlace(initial.id, values);
      toast.success("Cambios guardados correctamente");
    } else {
      addPlace(values);
      toast.success(`"${trimmedName}" se agregó a La Verde`);
    }
    setSubmitting(false);
    onDone();
  }, [
    name,
    categoryValue,
    categories,
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
      <div className="flex items-center justify-between gap-gap-sm mb-gap-lg">
        <div>
          <h1 className="font-display text-h3 font-bold text-foreground">
            {initial ? "Editar negocio" : "Nuevo negocio"}
          </h1>
          <p className="text-small text-muted-foreground mt-gap-2xs">
            {initial
              ? `${initial.name} · ${initial.barrio || "Cuba"}`
              : "Agrega un negocio al mapa de La Verde. Funciona en toda Cuba."}
          </p>
        </div>
      </div>

      <div className="space-y-gap-md">
        <FormSection
          title="Información del negocio"
          icon={<Store size={18} strokeWidth={1.5} />}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bfName">Nombre del negocio</Label>
              <Input
                id="bfName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Paladar El Sabroso"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bfCategory">Categoría</Label>
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
              <Label htmlFor="bfBarrio">Barrio / Municipio</Label>
              <Input
                id="bfBarrio"
                value={barrio}
                onChange={(e) => setBarrio(e.target.value)}
                placeholder="Ej: Centro, Vedado, Trinidad..."
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bfAddress">Dirección</Label>
              <Input
                id="bfAddress"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej: Calle 12 #45, entre 7 y 9"
              />
            </div>
            <div className="flex flex-col gap-gap-xs lg:col-span-2">
              <Label htmlFor="bfDesc">Descripción</Label>
              <textarea
                id="bfDesc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el negocio para que la IA lo recomiende mejor..."
                className="flex h-auto min-h-[80px] w-full rounded-lv border border-input bg-surface px-4 py-3 text-body text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y leading-relaxed"
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Horarios"
          icon={<Clock size={18} strokeWidth={1.5} />}
        >
          <div className="flex flex-col gap-gap-sm">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bfSchedule">Horario de atención</Label>
              <Input
                id="bfSchedule"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="Ej: 10:00 – 22:00"
              />
            </div>
            <div className="flex flex-wrap gap-[6px]">
              {SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSchedule(preset)}
                  className={cn(
                    "px-3 py-[6px] rounded-full border text-[12px] font-medium transition-all",
                    schedule === preset
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-foreground bg-background hover:border-accent hover:text-accent",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </FormSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gap-md">
          <FormSection
            title="Métodos de pago"
            icon={<CreditCard size={18} strokeWidth={1.5} />}
          >
            <p className="text-meta text-muted-foreground mb-gap-sm">
              Selecciona las monedas y métodos que acepta el negocio. Aparecen en la ficha del lugar.
            </p>
            <PaymentChips
              defaultSelected={initial?.payments ?? []}
              onChange={setPayments}
            />
          </FormSection>

          <FormSection
            title="Oferta especial"
            icon={<Tag size={18} strokeWidth={1.5} />}
          >
            <div className="flex items-center justify-between py-gap-sm border-b border-border gap-gap-sm">
              <div className="flex-1 min-w-0">
                <div className="text-small font-medium">Oferta activa</div>
                <div className="text-meta text-muted-foreground">Muestra un banner de oferta en la ficha</div>
              </div>
              <button
                type="button"
                onClick={() => setOfferEnabled((prev) => !prev)}
                role="switch"
                aria-checked={offerEnabled}
                className={cn(
                  "w-[48px] h-[28px] rounded-full relative cursor-pointer border-none p-0 transition-colors duration-normal shrink-0",
                  offerEnabled ? "bg-accent" : "bg-border",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow-lv-xs transition-transform duration-normal ease-out",
                    offerEnabled && "translate-x-5",
                  )}
                />
              </button>
            </div>
            {offerEnabled && (
              <div className="space-y-gap-xs mt-gap-sm">
                <div className="flex flex-col gap-gap-xs">
                  <Label htmlFor="bfOfferText">Texto de la oferta</Label>
                  <Input
                    id="bfOfferText"
                    value={offerText}
                    onChange={(e) => setOfferText(e.target.value)}
                    placeholder="Ej: 2x1 en bebidas, Almuerzo del día..."
                  />
                </div>
                <div className="flex flex-col gap-gap-xs">
                  <Label htmlFor="bfOfferExpiry">Válido hasta</Label>
                  <Input
                    id="bfOfferExpiry"
                    value={offerExpiry}
                    onChange={(e) => setOfferExpiry(e.target.value)}
                    placeholder="Ej: Válido hasta el 30 de septiembre"
                  />
                </div>
              </div>
            )}
          </FormSection>
        </div>

        <FormSection
          title="Menú / Servicios destacados"
          icon={<Utensils size={18} strokeWidth={1.5} />}
        >
          <p className="text-meta text-muted-foreground mb-gap-sm">
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
            icon={<Store size={18} strokeWidth={1.5} />}
          >
            <p className="text-meta text-muted-foreground mb-gap-sm">
              Controla cómo aparece el negocio en la app pública.
            </p>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bfStatus">Estado</Label>
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
            icon={<Zap size={18} strokeWidth={1.5} />}
          >
            <div className="flex items-center justify-between py-gap-sm border-b border-border gap-gap-sm">
              <div className="flex-1 min-w-0">
                <div className="text-small font-medium">Plan Destacado</div>
                <div className="text-meta text-muted-foreground">
                  Pin ámbar en el mapa, prioridad en recomendaciones IA, badge &ldquo;Destacado&rdquo; en la ficha.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBoosted((prev) => !prev)}
                role="switch"
                aria-checked={isBoosted}
                className={cn(
                  "w-[48px] h-[28px] rounded-full relative cursor-pointer border-none p-0 transition-colors duration-normal shrink-0",
                  isBoosted ? "bg-lv-amber" : "bg-border",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow-lv-xs transition-transform duration-normal ease-out",
                    isBoosted && "translate-x-5",
                  )}
                />
              </button>
            </div>
            {isBoosted && (
              <div className="flex flex-col gap-gap-xs mt-gap-sm">
                <Label htmlFor="bfBoostExpiry">Vigencia del destacado</Label>
                <Input
                  id="bfBoostExpiry"
                  value={boostExpiresAt}
                  onChange={(e) => setBoostExpiresAt(e.target.value)}
                  placeholder="Ej: 31 de agosto, 2026"
                />
              </div>
            )}
          </FormSection>
        </div>

        <FormSection
          title="Ubicación en el mapa"
          icon={<MapPin size={18} strokeWidth={1.5} />}
        >
          <p className="text-meta text-muted-foreground mb-gap-sm">
            Toca el mapa para colocar el pin, arrástralo para ajustar, o busca tu zona y usa
            &ldquo;Mi ubicación&rdquo;. No necesitas escribir coordenadas.
          </p>
          <MapLocationPicker value={location} onChange={setLocation} />
        </FormSection>

        {formError && (
          <div className="px-3 py-[7px] rounded-lv-lg bg-destructive/10 border border-destructive/25 text-[12px] text-destructive font-medium">
            {formError}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-gap-sm">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full lg:w-auto"
          >
            <Send size={18} strokeWidth={1.5} />
            {submitting
              ? "Guardando..."
              : initial
                ? "Guardar cambios"
                : "Agregar negocio"}
          </Button>
        </div>
      </div>
    </>
  );
}

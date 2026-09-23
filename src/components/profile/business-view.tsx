"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Send,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { CategoryIcon } from "@/components/admin/category-icon";
import { FormSection } from "@/components/business/form-section";
import { PaymentChips } from "@/components/business/payment-chips";
import { MapLocationPicker, type LocationPoint } from "@/components/map/MapLocationPicker";
import { usePlaces } from "@/providers/places-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Lo que `/api/me` devuelve en `business`. */
interface BusinessSummary {
  id: string;
  name: string;
  /** `false` mientras esté pendiente de que un administrador lo publique. */
  isActive: boolean;
}

const SCHEDULE_PRESETS = ["8:00 – 16:00", "9:00 – 18:00", "10:00 – 22:00", "12:00 – 24:00", "24 horas"];

/* Mismas clases que el formulario del panel de administración, que es el
   hermano de este. Se copian en vez de extraerse porque son dos sitios y un
   archivo compartido para dos cadenas de texto sería una indirección más que
   leer. Si aparece un tercero, se extraen. */
const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-gap-xs h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none";

/**
 * «Tengo un negocio», la sección del perfil.
 *
 * Es la puerta que un usuario normal no tenía. Antes de esto, el único camino
 * era una lista de espera que nadie escribía: existían el store, la API y la
 * pantalla de administración, pero ningún formulario que la llenara.
 *
 * Dos estados, y el segundo es el que hace que esto no sea solo un formulario:
 * quien ya tiene negocio ve el suyo con su estado y un botón al panel. Sin eso,
 * volver a esta pestaña mostraría otra vez el formulario y parecería que el alta
 * no se guardó.
 *
 * El alta no publica nada: el negocio nace pendiente y lo aprueba un
 * administrador. Por eso aquí se dice claramente, en vez de dejar que el dueño
 * mande el enlace a un amigo y no lo encuentre. El panel sí se abre al momento
 * —es suyo y tiene que poder rellenarlo—, con el aviso dentro.
 */
export function BusinessView() {
  const { categories, hydrated } = usePlaces();

  /* `null` = todavía no se sabe. Distinto de `false`, que es «no tiene». */
  const [business, setBusiness] = useState<BusinessSummary | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: { authenticated: boolean; user: { business?: BusinessSummary | null } | null }) => {
        if (!alive) return;
        setBusiness(data.authenticated ? data.user?.business ?? null : null);
      })
      .catch(() => {
        /* Sin red no se puede saber si tiene negocio. Se enseña el formulario,
           que es la suposición inofensiva: si ya tuviera uno, el `POST` lo
           rechaza con un 409 y el aviso lo dice. */
        if (alive) setBusiness(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (business === undefined) {
    return (
      <div className="flex flex-col items-center gap-gap-sm py-gap-xl text-small text-ink-soft/75">
        <Loader2 size={18} strokeWidth={1.8} className="animate-spin" />
        Cargando…
      </div>
    );
  }

  return business ? (
    <BusinessCard business={business} />
  ) : (
    <BusinessForm categoriesReady={hydrated && categories.length > 0} />
  );
}

/** Ya tiene negocio: qué es, cómo va, y por dónde se entra a editarlo. */
function BusinessCard({ business }: { business: BusinessSummary }) {
  return (
    <div className="flex flex-col gap-gap-md">
      <header className="flex flex-col gap-gap-xs">
        <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
          Tu negocio
        </span>
        <h2 className="font-lv-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink">
          {business.name}
        </h2>
      </header>

      <div className="flex flex-col gap-gap-sm rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
        <div className="flex items-center gap-gap-sm">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full",
              business.isActive ? "bg-verde-50 text-verde-600" : "bg-sand text-ink-soft/75",
            )}
          >
            {business.isActive ? (
              <BadgeCheck size={20} strokeWidth={1.8} />
            ) : (
              <Clock size={20} strokeWidth={1.8} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-lv-display text-small font-semibold text-ink">
              {business.isActive ? "Publicado" : "Pendiente de revisión"}
            </p>
            <p className="text-meta text-ink-soft/75">
              {business.isActive
                ? "Ya aparece en el buscador y en el mapa."
                : "Todavía no aparece en el buscador ni en el mapa. Un administrador lo revisa y lo publica."}
            </p>
          </div>
        </div>

        <Link href="/business" className={cn(BTN_PRIMARY, "w-full")}>
          Ir al panel de mi negocio
          <ArrowRight size={16} strokeWidth={1.8} />
        </Link>
      </div>
    </div>
  );
}

/** El alta. Un negocio por persona, y por eso no hay lista ni «añadir otro». */
function BusinessForm({ categoriesReady }: { categoriesReady: boolean }) {
  const { categories } = usePlaces();

  const [name, setName] = useState("");
  const [categoryValue, setCategoryValue] = useState("");
  const [barrio, setBarrio] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [schedule, setSchedule] = useState("");
  const [description, setDescription] = useState("");
  const [payments, setPayments] = useState<string[]>([]);
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /* La primera categoría en cuanto llegan, para que el desplegable no arranque
     vacío. No se pisa lo que el usuario haya elegido mientras tanto. */
  useEffect(() => {
    if (categoryValue || categories.length === 0) return;
    setCategoryValue(categories[0]!.value);
  }, [categories, categoryValue]);

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Escribe el nombre de tu negocio.");
      return;
    }
    if (!location) {
      setError("Marca tu negocio en el mapa: toca el punto donde está o busca su dirección.");
      return;
    }

    setError(null);
    setSending(true);

    /* La categoría viaja como **etiqueta** («Restaurante»), no como slug: es lo
       que espera `resolveCategoryId` en el servidor, que busca por nombre. */
    const categoryLabel = categories.find((c) => c.value === categoryValue)?.label ?? "";

    try {
      const response = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          category: categoryLabel,
          description: description.trim(),
          address: address.trim(),
          barrio: barrio.trim(),
          phone: phone.trim(),
          schedule: schedule.trim(),
          payments,
          lat: location.lat,
          lng: location.lng,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No se pudo dar de alta el negocio. Inténtalo otra vez.");
        setSending(false);
        return;
      }

      /* Carga limpia y no `setState`: al terminar cambian tres cosas a la vez
         —el rol en la base, el enlace del menú y esta misma sección—, y solo
         recargando se enteran todas. La sección se conserva porque sigue en la
         URL (`?seccion=negocio`), así que se vuelve aquí mismo, ya con el
         negocio. */
      window.location.reload();
    } catch {
      setError("No hubo respuesta del servidor. Revisa tu conexión: no se cambió nada.");
      setSending(false);
    }
  }, [
    name,
    location,
    categories,
    categoryValue,
    description,
    address,
    barrio,
    phone,
    schedule,
    payments,
  ]);

  return (
    <div className="flex flex-col gap-gap-md">
      <header className="flex flex-col gap-gap-xs">
        <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
          Para negocios
        </span>
        <h2 className="font-lv-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Registra tu negocio
        </h2>
        <p className="text-small text-pretty text-ink-soft/75">
          Con esto queda dado de alta y se te abre el panel para completarlo:
          fotos, horarios, menú y ofertas.{" "}
          <span className="font-semibold text-ink">
            No se publica de inmediato
          </span>{" "}
          — un administrador lo revisa antes de que salga en el mapa.
        </p>
      </header>

      <FormSection title="Lo esencial" icon={<Store size={18} strokeWidth={1.8} />}>
        <div className="flex flex-col gap-gap-md">
          <div className="flex flex-col gap-gap-xs">
            <label htmlFor="pbName" className={LABEL}>
              Nombre del negocio
            </label>
            <input
              id="pbName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Paladar El Sabroso"
              className={INPUT}
            />
          </div>

          <div className="flex flex-col gap-gap-xs">
            <label htmlFor="pbCategory" className={LABEL}>
              Categoría
            </label>
            <Select
              value={categoryValue}
              onValueChange={setCategoryValue}
              disabled={!categoriesReady}
            >
              <SelectTrigger id="pbCategory">
                <SelectValue placeholder={categoriesReady ? "Elige una" : "Cargando…"} />
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
            <label htmlFor="pbDesc" className={LABEL}>
              Descripción
            </label>
            <textarea
              id="pbDesc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qué ofreces y qué te hace distinto. Es lo que el buscador usa para recomendarte."
              className={cn(INPUT, "h-auto min-h-[80px] resize-y py-3 leading-relaxed")}
            />
          </div>

          <div className="flex flex-col gap-gap-xs">
            <label htmlFor="pbPhone" className={LABEL}>
              Teléfono <span className="font-normal">(opcional)</span>
            </label>
            <input
              id="pbPhone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+53 5 123 4567"
              className={INPUT}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Dónde está" icon={<MapPin size={18} strokeWidth={1.8} />}>
        <p className="mb-gap-sm text-meta text-ink-soft/75">
          Busca la dirección y ajusta el pin, o toca directamente el punto en el
          mapa. La dirección y el barrio se rellenan solos.
        </p>
        <MapLocationPicker
          value={location}
          onChange={setLocation}
          onResolved={(r) => {
            if (!r) return;
            /* No pisa una dirección escrita a mano con entre-calles («e/ A y B»),
               que es más precisa que la que devuelve el geocodificador. */
            setAddress((prev) => (prev.trim() === "" || !/e\/|entre/i.test(prev) ? r.address : prev));
            setBarrio((prev) => (prev.trim() ? prev : r.barrio));
          }}
        />

        <div className="mt-gap-md grid grid-cols-1 gap-gap-md lg:grid-cols-2">
          <div className="flex flex-col gap-gap-xs">
            <label htmlFor="pbAddress" className={LABEL}>
              Dirección
            </label>
            <input
              id="pbAddress"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Calle 12 #45, entre 7 y 9"
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-gap-xs">
            <label htmlFor="pbBarrio" className={LABEL}>
              Barrio / Municipio
            </label>
            <input
              id="pbBarrio"
              value={barrio}
              onChange={(e) => setBarrio(e.target.value)}
              placeholder="Ej: Centro histórico"
              className={INPUT}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Cómo te encuentran" icon={<Clock size={18} strokeWidth={1.8} />}>
        <div className="flex flex-col gap-gap-sm">
          <div className="flex flex-col gap-gap-xs">
            <label htmlFor="pbSchedule" className={LABEL}>
              Horario de atención
            </label>
            <input
              id="pbSchedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Ej: 10:00 – 22:00"
              className={INPUT}
            />
          </div>
          <div className="flex flex-wrap gap-[6px]">
            {SCHEDULE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSchedule(preset)}
                aria-pressed={schedule === preset}
                className={cn(
                  "select-none rounded-full border px-[14px] py-2 font-lv-display text-meta font-medium transition-all duration-500 ease-outquint active:scale-[0.98]",
                  schedule === preset
                    ? "border-verde-400 bg-verde-400 text-verde-950 shadow-soft"
                    : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </FormSection>

      <FormSection title="Métodos de pago" icon={<CreditCard size={18} strokeWidth={1.8} />}>
        <p className="mb-gap-sm text-meta text-ink-soft/75">
          Las monedas que aceptas. Es uno de los filtros que más se usan al buscar.
        </p>
        <PaymentChips defaultSelected={payments} onChange={setPayments} />
      </FormSection>

      <AnimatePresence>
        {error && (
          <motion.p
            key="pb-error"
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={submit}
        disabled={sending || !categoriesReady}
        className={cn(BTN_PRIMARY, "w-full")}
      >
        {sending ? (
          <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
        ) : (
          <Send size={16} strokeWidth={1.8} />
        )}
        {sending ? "Dando de alta…" : "Dar de alta mi negocio"}
      </button>
    </div>
  );
}

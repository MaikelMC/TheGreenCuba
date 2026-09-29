"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  Check,
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
import { PLAN_LABEL, type PlacePlan } from "@/lib/places-store";
import { focusProfileControl } from "@/components/profile/focus-profile-control";
import { trackBusinessSubmitted } from "@/lib/analytics";
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
  reviewStatus: "pending" | "approved" | "rejected";
  /** El plan con el que se dio de alta. `null` en fichas que no pasaron por
      este formulario. */
  plan: PlacePlan | null;
  category: string;
  description: string | null;
  address: string | null;
  barrio: string | null;
  phone: string | null;
  /* La sección «Contacto». Los cuatro llegan desde `/api/me` y vuelven en el
     `POST`, para que una solicitud rechazada se reenvíe con lo que ya se había
     escrito en vez de con los campos en blanco. */
  website: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  schedule: string | null;
  lat: number;
  lng: number;
  payments: string[] | null;
}

const SCHEDULE_PRESETS = ["8:00 – 16:00", "9:00 – 18:00", "10:00 – 22:00", "12:00 – 24:00", "24 horas"];

/**
 * Lo que la plataforma da, dicho **una sola vez**.
 *
 * Los beneficios son los que ya existen de verdad —búsqueda en lenguaje natural,
 * recomendación por IA, ficha completa, estadísticas— más el destacado, que hoy
 * enciende un administrador a mano desde `/admin/negocios` (ver el «Plan
 * Destacado» del formulario de allí, que es de donde sale este texto). No se
 * promete nada que no exista: la lista se puede comprobar en la app.
 *
 * Están aquí y no dentro del plan de prueba porque el de pago da **estos
 * mismos** —lo dice su propia frase: «todo lo del plan anterior»—. Con la lista
 * solo en el primero, la tarjeta de pago salía con la mitad de alto que su
 * vecina y un hueco muerto en medio; y repetir los cinco textos serían dos
 * listas obligadas a decir lo mismo para siempre.
 */
const BENEFITS = [
  "Buscador con IA: te encuentra quien busca con sus propias palabras.",
  "La IA te recomienda cuando alguien pide justo lo que ofreces.",
  "Ficha completa: fotos, horarios, menú, ofertas y formas de pago.",
  "Publicidad en el mapa: pin destacado y sello «Destacado» en tu ficha.",
  "Estadísticas: guardados, reseñas, fotos y valoración.",
] as const;

/**
 * Los dos planes del alta.
 *
 * El precio va partido en dos —cantidad y periodo— porque son dos cosas con
 * pesos distintos: el número se lee y el periodo se confirma. Juntos en una
 * cadena («10 USD al mes · 100 USD al año») el importe del año se perdía como
 * una nota al pie, y es justo el que interesa vender.
 */
const PLANS = [
  {
    id: "trial",
    badge: "Recomendado",
    title: "Eres nuevo",
    tagline: "Un negocio nuevo disfruta de todos los servicios durante su primer mes, gratis.",
    price: "0 USD",
    period: "el primer mes",
    benefits: BENEFITS,
  },
  {
    id: "paid",
    title: "Plan de pago",
    tagline: "Todo lo del plan anterior, sin fecha de caducidad.",
    price: "10 USD",
    period: "al mes",
    note: "100 USD al año · dos meses gratis",
    benefits: BENEFITS,
  },
] as const;

/* Mismas clases que el formulario del panel de administración, que es el
   hermano de este. Se copian en vez de extraerse porque son dos sitios y un
   archivo compartido para dos cadenas de texto sería una indirección más que
   leer. Si aparece un tercero, se extraen. */
const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-gap-xs h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none";

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
 * mande el enlace a un amigo y no lo encuentre. El panel tampoco se abre hasta
 * entonces —`/business` devuelve aquí mientras la ficha no esté publicada—, así
 * que esta tarjeta es todo lo que hay mientras espera: sin el botón, un enlace
 * que rebota.
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

  return business?.reviewStatus === "rejected" ? (
    <BusinessForm initialBusiness={business} categoriesReady={hydrated && categories.length > 0} />
  ) : business ? (
    <BusinessCard business={business} />
  ) : (
    <BusinessForm categoriesReady={hydrated && categories.length > 0} />
  );
}

/** Ya tiene negocio: qué es, cómo va, y por dónde se entra a editarlo. */
function BusinessCard({ business }: { business: BusinessSummary }) {
  const pending = business.reviewStatus === "pending";
  return (
  <div className="flex flex-col gap-gap-md">
      {/* El nombre del negocio es el titular de esta vista; el título de
          sección («Tengo un negocio») ya lo pinta la barra superior. */}
      <header className="flex flex-col gap-gap-xs">
        <h2 className="font-lv-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink">
          {business.name}
        </h2>
        {/* El plan que eligió, para que lo vea también quien lo eligió. Es el
            mismo rótulo que usa el panel de administración: un solo nombre por
            plan en toda la app. */}
        {business.plan && (
          <span className="inline-flex w-fit items-center rounded-full border border-verde-200 bg-verde-50 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-700">
            {PLAN_LABEL[business.plan]}
          </span>
        )}
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
              {business.isActive ? "Publicado" : pending ? "Pendiente de revisión" : "Revisión"}
            </p>
            <p className="text-meta text-ink-soft/75">
              {business.isActive
                ? "Ya aparece en el buscador y en el mapa."
                : "Todavía no aparece en el buscador ni en el mapa. Un administrador lo revisa y lo publica."}
            </p>
          </div>
        </div>

        {business.isActive ? (
          <Link href="/business" className={cn(BTN_PRIMARY, "w-full")}>
            Ir al panel de mi negocio
            <ArrowRight size={16} strokeWidth={1.8} />
          </Link>
        ) : (
          <p className="rounded-xl bg-sand px-gap-md py-gap-sm text-meta text-ink-soft/75">
            El panel se abre solo cuando un administrador apruebe tu solicitud.
            Vuelve a esta página y aquí estará el botón.
          </p>
        )}
      </div>
    </div>
  );
}

/** El alta. Un negocio por persona, y por eso no hay lista ni «añadir otro». */
function BusinessForm({
  categoriesReady,
  initialBusiness,
}: {
  categoriesReady: boolean;
  initialBusiness?: BusinessSummary;
}) {
  const { categories } = usePlaces();

  const [name, setName] = useState(initialBusiness?.name ?? "");
  const [categoryValue, setCategoryValue] = useState(initialBusiness?.category ?? "");
  const [barrio, setBarrio] = useState(initialBusiness?.barrio ?? "");
  const [address, setAddress] = useState(initialBusiness?.address ?? "");
  const [phone, setPhone] = useState(initialBusiness?.phone ?? "");
  /* Sección «Contacto». Ninguno es obligatorio: un negocio sin web o sin
     redes es el caso normal, y la ficha no pinta el botón que falte. */
  const [website, setWebsite] = useState(initialBusiness?.website ?? "");
  const [whatsapp, setWhatsapp] = useState(initialBusiness?.whatsapp ?? "");
  const [instagram, setInstagram] = useState(initialBusiness?.instagram ?? "");
  const [facebook, setFacebook] = useState(initialBusiness?.facebook ?? "");
  const [schedule, setSchedule] = useState(initialBusiness?.schedule ?? "");
  const [description, setDescription] = useState(initialBusiness?.description ?? "");
  const [payments, setPayments] = useState<string[]>(initialBusiness?.payments ?? []);
  const [location, setLocation] = useState<LocationPoint | null>(
    initialBusiness ? { lat: initialBusiness.lat, lng: initialBusiness.lng } : null,
  );
  /* El plan se elige aquí y **viaja con el alta**: se guarda en la ficha, que
     es lo que lo hace persistente, y es lo que el administrador ve en la
     solicitud antes de aprobarla. No se cobra nada todavía. El mes de prueba
     viene marcado porque es el que quiere todo el mundo, y cambiarlo tiene que
     costar un clic, no dos. */
  const [plan, setPlan] = useState<(typeof PLANS)[number]["id"]>(initialBusiness?.plan ?? "trial");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  /* `true` cuando la solicitud ya se registró y la pantalla pasa a la vista de
     confirmación. El usuario no vuelve a enviar el formulario, y el botón de
     salida lo lleva al mapa con el aviso claro de revisión. */
  const [created, setCreated] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
          website: website.trim(),
          whatsapp: whatsapp.trim(),
          instagram: instagram.trim(),
          facebook: facebook.trim(),
          schedule: schedule.trim(),
          payments,
          lat: location.lat,
          lng: location.lng,
          plan,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No se pudo dar de alta el negocio. Inténtalo otra vez.");
        setSending(false);
        return;
      }

      setCreated(true);
      setSubmitted(true);
      setSending(false);
      setError(null);
      trackBusinessSubmitted({
        plan,
        category: categoryLabel,
        /* El formulario ya no sube fotos —el bucket rechazaba las subidas y se
           retiró el bloque entero—, así que el recuento va a cero. El campo se
           queda para no romper la serie que ya hay en PostHog. */
        photoCount: 0,
      });
      toast.success("Tu negocio quedó enviado para revisión. Te avisaremos cuando sea revisado.");
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
    website,
    whatsapp,
    instagram,
    facebook,
    schedule,
    payments,
  ]);

  return (
    <div className="flex flex-col gap-gap-md" onPointerDownCapture={focusProfileControl}>
      {/* «Registra tu negocio» repetía el título de la sección que ya está en
          la barra superior; la introducción basta para orientar, también en el
          reenvío de una solicitud rechazada. */}
      <header className="flex flex-col gap-gap-xs">
        <p className="text-small text-pretty text-ink-soft/75">
          {initialBusiness
            ? "Actualiza los datos que indicó el administrador y vuelve a enviarla para revisión."
            : "Completa los datos de tu negocio para enviarlo a revisión."}
        </p>
        <p className="text-small text-pretty text-ink-soft/75">
          Con esto queda dado de alta.{" "}
          <span className="font-semibold text-ink">
            No se publica de inmediato
          </span>{" "}
          — un administrador lo revisa antes de que salga en el mapa, y el panel
          se abre para completarlo (fotos, horarios, menú, ofertas) en cuanto lo
          apruebe.
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

      <FormSection title="Contacto" icon={<AtSign size={18} strokeWidth={1.8} />}>
        <p className="mb-gap-sm text-meta text-ink-soft/75">
          Todo opcional. Son los botones que aparecen en tu ficha: el que dejes
          vacío no se pinta.
        </p>
        <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
          <div className="flex flex-col gap-gap-xs">
            <label htmlFor="pbWebsite" className={LABEL}>
              Sitio web
            </label>
            <input
              id="pbWebsite"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="Ej: laverde.cu"
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-gap-xs">
            <label htmlFor="pbWhatsapp" className={LABEL}>
              WhatsApp
            </label>
            <input
              id="pbWhatsapp"
              type="tel"
              autoComplete="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+53 5 123 4567"
              className={INPUT}
            />
            {/* El teléfono ya está en «Lo esencial» y sin esta frase los dos
                campos se leían como el mismo dato escrito dos veces. */}
            <p className="text-meta text-ink-soft/75">
              El número con el que te escriben: abre WhatsApp desde tu ficha.
            </p>
          </div>
          <div className="flex flex-col gap-gap-xs">
            <label htmlFor="pbInstagram" className={LABEL}>
              Instagram
            </label>
            <input
              id="pbInstagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="Ej: @laverde"
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-gap-xs">
            <label htmlFor="pbFacebook" className={LABEL}>
              Facebook
            </label>
            <input
              id="pbFacebook"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="Ej: facebook.com/laverde"
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

      {/* Va la última, después de los datos y el mapa, que es donde el usuario
          ya sabe qué está pidiendo. Radios nativos y no botones: el teclado y el
          lector de pantalla ya saben qué hacer con ellos. */}
      <FormSection title="Tu plan" icon={<BadgeCheck size={18} strokeWidth={1.8} />}>
        <p className="mb-gap-sm text-meta text-ink-soft/75">
          Elige cómo empiezas. Se puede cambiar después.
        </p>

        <fieldset className="grid grid-cols-1 gap-gap-sm lg:grid-cols-2">
          <legend className="sr-only">Plan</legend>
          {PLANS.map((option) => {
            const selected = plan === option.id;

            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer flex-col gap-gap-sm rounded-2xl border p-gap-md transition-all duration-500 ease-outquint focus-within:ring-2 focus-within:ring-verde-400/40",
                  selected
                    ? "border-verde-400 bg-verde-50/60 shadow-soft"
                    : "border-ink/10 bg-white hover:border-verde-300",
                )}
              >
                <input
                  type="radio"
                  name="plan"
                  value={option.id}
                  checked={selected}
                  onChange={() => setPlan(option.id)}
                  className="sr-only"
                />

                <div className="flex items-start justify-between gap-gap-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-gap-xs">
                      <span className="font-lv-display text-small font-semibold text-ink">
                        {option.title}
                      </span>
                      {"badge" in option && (
                        <span className="inline-flex items-center gap-[4px] rounded-full bg-verde-400 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-950">
                          <BadgeCheck size={12} strokeWidth={2} />
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-[2px] text-meta text-pretty text-ink-soft/75">{option.tagline}</p>
                  </div>

                  <span
                    className={cn(
                      "mt-[2px] grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-500 ease-outquint",
                      selected ? "border-verde-500 bg-verde-500 text-white" : "border-ink/15 bg-white",
                    )}
                  >
                    {selected && <Check size={12} strokeWidth={3} />}
                  </span>
                </div>

                {option.benefits.length > 0 && (
                  <ul className="flex flex-col gap-[6px]">
                    {option.benefits.map((benefit) => (
                      <li
                        key={benefit}
                        className="flex items-start gap-gap-xs text-meta text-pretty text-ink-soft/75"
                      >
                        <Check
                          size={14}
                          strokeWidth={2}
                          className="mt-[2px] shrink-0 text-verde-600"
                        />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                )}

                {/* `mt-auto`: en pantalla ancha las dos tarjetas miden lo mismo y
                    el precio queda abajo en las dos, a la misma altura. */}
                <div className="mt-auto border-t border-ink/5 pt-gap-sm">
                  <p className="flex flex-wrap items-baseline gap-x-[6px]">
                    <span className="font-lv-display text-body font-semibold tabular-nums text-ink">
                      {option.price}
                    </span>
                    <span className="text-meta text-ink-soft/75">{option.period}</span>
                  </p>
                  {/* La línea del año va en verde y no en gris: es el argumento
                      de esta tarjeta contra la de al lado, y hasta ahora estaba
                      de nota al pie, del mismo color que un pie de foto. */}
                  {"note" in option && (
                    <p className="mt-[4px] text-meta font-medium text-verde-700">{option.note}</p>
                  )}
                </div>
              </label>
            );
          })}
        </fieldset>
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

      {submitted ? (
        <div className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
          <div className="flex items-start gap-gap-sm">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sand text-verde-600">
              <Clock size={20} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-lv-display text-small font-semibold text-ink">
                Espera menos de 24 horas
              </p>
              <p className="mt-[2px] text-meta text-ink-soft/75">
                Un administrador revisará tu solicitud y la publicará en el mapa cuando esté aprobada.
              </p>
            </div>
          </div>

          <Link href="/home" className={cn(BTN_PRIMARY, "mt-gap-md w-full")}>
            Volver al mapa
            <ArrowRight size={16} strokeWidth={1.8} />
          </Link>
        </div>
      ) : (
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
      )}
    </div>
  );
}

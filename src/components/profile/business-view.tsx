"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  CreditCard,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  Send,
  Store,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { prepareImage } from "@/lib/storage/compress";
import { CategoryIcon } from "@/components/admin/category-icon";
import { FormSection } from "@/components/business/form-section";
import { PaymentChips } from "@/components/business/payment-chips";
import { MapLocationPicker, type LocationPoint } from "@/components/map/MapLocationPicker";
import { usePlaces } from "@/providers/places-provider";
import { PLAN_LABEL, type PlacePlan } from "@/lib/places-store";
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
  /** El plan con el que se dio de alta. `null` en fichas que no pasaron por
      este formulario. */
  plan: PlacePlan | null;
}

const SCHEDULE_PRESETS = ["8:00 – 16:00", "9:00 – 18:00", "10:00 – 22:00", "12:00 – 24:00", "24 horas"];

/* Ocho fotos, el mismo tope que la rejilla del panel. Se repite el número en
   vez de importarlo de `photo-grid`: son dos pantallas y traer el componente
   entero —con `next/image` y el provider— al formulario del perfil por una
   constante no sale a cuenta. Si aparece un tercero, se extrae. */
const MAX_PHOTOS = 8;

/* Mismas clases que la rejilla del panel, por lo mismo que las del formulario. */
const TILE_REMOVE =
  "absolute top-[6px] right-[6px] size-7 rounded-full bg-ink/70 text-white grid place-items-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-500 ease-outquint z-10 cursor-pointer";
const TILE_ADD =
  "aspect-square rounded-2xl border border-dashed border-ink/10 flex flex-col items-center justify-center gap-[6px] cursor-pointer text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 transition-all duration-500 ease-outquint";

/**
 * Los dos planes del alta.
 *
 * Los beneficios son los que la plataforma ya da de verdad —búsqueda en lenguaje
 * natural, recomendación por IA, ficha completa, estadísticas— más el destacado,
 * que hoy enciende un administrador a mano desde `/admin/negocios` (ver el
 * «Plan Destacado» del formulario de allí, que es de donde sale este texto). No
 * se promete nada que no exista: la lista se puede comprobar en la app.
 */
const PLANS = [
  {
    id: "trial",
    badge: "Recomendado",
    title: "Eres nuevo",
    tagline: "Un negocio nuevo disfruta de todos los servicios durante su primer mes, gratis.",
    price: "0 USD el primer mes",
    benefits: [
      "Buscador con IA: te encuentra quien busca con sus propias palabras.",
      "La IA te recomienda cuando alguien pide justo lo que ofreces.",
      "Ficha completa: fotos, horarios, menú, ofertas y formas de pago.",
      "Publicidad en el mapa: pin destacado y sello «Destacado» en tu ficha.",
      "Estadísticas: guardados, reseñas, fotos y valoración.",
    ],
  },
  {
    id: "paid",
    title: "Plan de pago",
    tagline: "Todo lo del plan anterior, sin fecha de caducidad.",
    price: "10 USD al mes · 100 USD al año",
    note: "Pagando el año, dos meses gratis.",
  },
] as const;

/**
 * Sube las fotos elegidas al negocio recién creado.
 *
 * Va después del `POST /api/business` y no antes porque `place_images.place_id`
 * es clave foránea: sin ficha no hay dónde colgarlas. Devuelve **cuántas
 * fallaron y por qué** en vez de lanzar: el alta ya está hecha y no se puede
 * deshacer, así que un fallo de subida no puede tumbar la respuesta que el
 * usuario espera. El aviso lo da quien llama.
 *
 * El motivo se guarda, y no solo el número: la primera versión contaba fallos y
 * decía «no se pudieron subir», que es lo mismo que no decir nada. Un 401, un
 * 413 y un 403 del bucket se arreglan de formas distintas y desde sitios
 * distintos.
 */
async function uploadPhotos(
  placeId: string,
  files: File[],
  placeName: string,
): Promise<{ failed: number; reason: string | null }> {
  let failed = 0;
  let reason: string | null = null;

  for (const file of files) {
    try {
      const prepared = await prepareImage(file);

      const form = new FormData();
      form.append("file", prepared.blob, prepared.name);
      form.append("alt", `Foto de ${placeName}`);
      /* Las dimensiones solo sirven para reservar el hueco antes de que la
         imagen cargue. Si no se pudieron leer, se omiten. */
      if (prepared.width) form.append("width", String(prepared.width));
      if (prepared.height) form.append("height", String(prepared.height));

      const res = await fetch(`/api/places/${placeId}/images`, { method: "POST", body: form });
      if (!res.ok) {
        failed++;
        /* La ruta contesta `{error}` en todo lo que comprueba ella. Un fallo del
           bucket no llega hasta ahí: revienta antes y Next devuelve su página
           de error, que no es JSON. De ahí el `catch` y el código de estado. */
        if (!reason) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          reason = data?.error ?? `El servidor respondió ${res.status}.`;
        }
      }
    } catch (e) {
      /* `prepareImage` solo lanza si el archivo pasa del tope. Una foto de menos
         no puede impedir que el negocio quede dado de alta. */
      failed++;
      if (!reason) reason = e instanceof Error ? e.message : "No se pudo preparar la imagen.";
    }
  }

  return { failed, reason };
}

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
              {business.isActive ? "Publicado" : "Pendiente de revisión"}
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
  /* Las fotos elegidas, todavía sin dueño: el negocio no existe hasta que se
     envía el formulario. Se quedan en memoria y se suben justo después del alta. */
  const [photos, setPhotos] = useState<File[]>([]);
  /* El plan se elige aquí y **viaja con el alta**: se guarda en la ficha, que
     es lo que lo hace persistente, y es lo que el administrador ve en la
     solicitud antes de aprobarla. No se cobra nada todavía. El mes de prueba
     viene marcado porque es el que quiere todo el mundo, y cambiarlo tiene que
     costar un clic, no dos. */
  const [plan, setPlan] = useState<(typeof PLANS)[number]["id"]>("trial");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  /* `true` cuando el alta ya se hizo pero alguna foto no subió. El botón deja de
     dar de alta —repetir sería un 409— y pasa a llevar al perfil. */
  const [created, setCreated] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  /* La primera categoría en cuanto llegan, para que el desplegable no arranque
     vacío. No se pisa lo que el usuario haya elegido mientras tanto. */
  useEffect(() => {
    if (categoryValue || categories.length === 0) return;
    setCategoryValue(categories[0]!.value);
  }, [categories, categoryValue]);

  /* Vista previa de lo elegido. El `src` de un `<img>` no admite un `File`, así
     que cada uno necesita su URL de objeto, y esas hay que soltarlas: se crean
     nuevas en cada cambio de la lista y se revocan las viejas cuando React ya ha
     pintado las nuevas. */
  const previews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos],
  );
  useEffect(
    () => () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [previews],
  );

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
          plan,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No se pudo dar de alta el negocio. Inténtalo otra vez.");
        setSending(false);
        return;
      }

      /* Las fotos van ahora, con el id que acaba de devolver el alta, y no
         pueden impedirla: si alguna falla el negocio ya está creado y quedaría
         peor dejarlo a medias sin decirlo. */
      const { id } = (await response.json()) as { id: string };
      const { failed, reason } = await uploadPhotos(id, photos, trimmed);

      if (failed > 0) {
        setSending(false);
        setCreated(true);
        setError(
          `Tu negocio quedó dado de alta, pero ${
            failed === 1 ? "una foto no se pudo subir" : `${failed} fotos no se pudieron subir`
          }${reason ? `: ${reason}` : ""}. Se añaden desde el panel cuando te aprueben la ficha.`,
        );
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
    photos,
  ]);

  return (
    <div className="flex flex-col gap-gap-md">
      {/* «Registra tu negocio» repetía el título de la sección que ya está en
          la barra superior; la introducción basta para orientar. */}
      <header className="flex flex-col gap-gap-xs">
        <p className="text-small text-pretty text-ink-soft/75">
          Con esto queda dado de alta, con las fotos que subas.{" "}
          <span className="font-semibold text-ink">
            No se publica de inmediato
          </span>{" "}
          — un administrador lo revisa antes de que salga en el mapa, y el panel
          se abre para completarlo (horarios, menú, ofertas) en cuanto lo apruebe.
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

      <FormSection title="Fotos" icon={<ImageIcon size={18} strokeWidth={1.8} />}>
        <p className="mb-gap-sm text-meta text-ink-soft/75">
          Opcional, hasta {MAX_PHOTOS}. Se reducen a 1600 px y se convierten a
          WebP antes de salir de tu dispositivo. La primera será la portada.
          También se pueden añadir después, ya con el panel abierto.
        </p>

        {/* El negocio no existe todavía, así que las fotos se quedan aquí
            elegidas y se suben en cuanto el alta devuelva su id. */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
            /* Se vacía el input para que elegir otra vez el mismo archivo vuelva
               a disparar el `change`. */
            e.target.value = "";
            setPhotos((prev) => [...prev, ...picked]);
          }}
        />

        <div className="grid grid-cols-3 gap-gap-xs lg:grid-cols-4">
          {previews.map(({ file, url }, index) => (
            <div
              key={url}
              className="relative aspect-square overflow-hidden rounded-2xl border border-ink/5 bg-sand-deep group"
            >
              {/* `<img>` y no `next/image`: la URL es un objeto local del
                  navegador y el optimizador no tiene nada que optimizar aquí. */}
              <img
                src={url}
                alt={`Vista previa de ${file.name}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                aria-label={`Quitar ${file.name}`}
                className={TILE_REMOVE}
              >
                <X size={14} strokeWidth={1.8} />
              </button>
              {index === 0 && (
                <span className="absolute bottom-[8px] left-[8px] rounded-full bg-ink/70 px-[10px] py-[3px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                  Portada
                </span>
              )}
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className={TILE_ADD}
            >
              <Plus size={24} strokeWidth={1.8} />
              <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em]">
                Añadir
              </span>
            </button>
          )}
        </div>
      </FormSection>

      {/* Va la última, después de los datos y las fotos, que es donde el usuario
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
            const benefits = "benefits" in option ? option.benefits : [];

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

                {benefits.length > 0 && (
                  <ul className="flex flex-col gap-[6px]">
                    {benefits.map((benefit) => (
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
                  <p className="font-lv-display text-small font-semibold text-ink">{option.price}</p>
                  {"note" in option && <p className="text-meta text-ink-soft/75">{option.note}</p>}
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

      {/* Con el alta ya hecha —y alguna foto perdida— el botón solo puede
          llevar al perfil: volver a enviar el formulario sería un 409. */}
      <button
        type="button"
        onClick={created ? () => window.location.reload() : submit}
        disabled={sending || (!created && !categoriesReady)}
        className={cn(BTN_PRIMARY, "w-full")}
      >
        {sending ? (
          <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
        ) : (
          <Send size={16} strokeWidth={1.8} />
        )}
        {created ? "Ir a mi perfil" : sending ? "Dando de alta…" : "Dar de alta mi negocio"}
      </button>
    </div>
  );
}

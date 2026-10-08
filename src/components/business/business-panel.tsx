"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  Clock,
  CreditCard,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  Save,
  Store,
  Tag,
  Utensils,
  User as UserIcon,
  Zap,
} from "lucide-react";
import { cn, sanitizePhone } from "@/lib/utils";
import { normalizarWhatsappCubano } from "@/lib/contact-links";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { logout } from "@/lib/logout";
import { formatCoordinates } from "@/lib/map/coordinates";
import { placeIcon } from "@/lib/places";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryIcon } from "@/components/admin/category-icon";
import { IconPicker } from "@/components/ui/icon-picker";
import { FormSection, FormSections } from "@/components/business/form-section";
import { PanelShell } from "@/components/business/panel-shell";
import { DashboardStats } from "@/components/business/dashboard-stats";
import { EstadisticasPanel } from "@/components/business/estadisticas-panel";
import { PhotoGrid } from "@/components/business/photo-grid";
import { PaymentChips } from "@/components/business/payment-chips";
import { MenuItemEditor } from "@/components/business/menu-item-editor";
import { MenuLinkCard } from "@/components/business/menu-link-card";
import { PlanCard } from "@/components/business/plan-card";
import { PlansSection } from "@/components/business/plans-section";
import {
  BusinessSwitcher,
  type NegocioPanel,
} from "@/components/business/business-switcher";
import { PLAN_LABEL, incluye, textoBloqueo, type Plan } from "@/lib/plans";
import {
  ENERGIA_LABEL,
  ENERGIA_ORDER,
  type EnergiaRespaldo,
} from "@/lib/energia";
import { pruneMenuImages } from "@/lib/menu-images";
import { MapLocationPicker, type LocationPoint } from "@/components/map/MapLocationPicker";
import { usePlaces } from "@/providers/places-provider";
import type { VisitasPanel } from "@/lib/eventos";
import type { PlaceStatus, UserPlace, UserPlacePatch } from "@/lib/places-store";

/** Los tres números reales que el panel puede contar. Se declaran aquí y no se
    importan de `queries.ts`: ese módulo arrastra la base de datos y la caché de
    Next, y traerlo —aunque fuera solo por un tipo— a un componente de cliente
    es la clase de import que un día alguien convierte en normal y se lleva el
    driver al navegador. */
interface PlaceStats {
  saved: number;
  reviews: number;
  photos: number;
}

const SCHEDULE_PRESETS = ["8:00 – 16:00", "9:00 – 18:00", "10:00 – 22:00", "12:00 – 24:00", "24 horas"];

const STATUS_OPTIONS: { value: PlaceStatus; label: string; hint: string }[] = [
  { value: "active", label: "Abierto", hint: "Es lo que se enseña por defecto." },
  { value: "temporary_closed", label: "Cerrado temporalmente", hint: "La ficha avisa de que ahora no abre." },
  { value: "closed", label: "Cerrado", hint: "La ficha se sigue viendo, marcada como cerrada." },
];

/* Mismas clases que el resto de formularios del proyecto. */
const INPUT =
  "rounded-xl border-ink/10 bg-white text-ink placeholder:text-ink-soft/75 focus-visible:border-verde-400 focus-visible:ring-offset-0 focus-visible:ring-verde-400/30";

/**
 * El panel del negocio.
 *
 * Recibe la ficha ya resuelta del servidor —`/business/page.tsx` la lee de
 * `business_owners` para el usuario de la sesión— y **ya no hay ningún dato
 * escrito a fuego**. Antes este armazón tenía a fuego el nombre, la dirección,
 * la descripción, la oferta y un dashboard entero de cifras inventadas, y
 * `PhotoGrid` apuntaba al id del negocio que siembra `db:seed`.
 *
 * Eso importaba poco mientras `/business` fuera un prototipo que solo veía quien
 * supiera el rol de la cuenta de demostración. Con el alta desde el perfil deja
 * de importar poco: quien acaba de registrar su negocio entra aquí y tiene que
 * ver **el suyo**.
 */
export function BusinessPanel({
  place,
  stats,
  visitas,
  menuUrl,
  plan,
  puedeElegirPlan,
  negocios,
}: {
  place: UserPlace;
  stats: PlaceStats;
  /** Las estadísticas del mes, **ya recortadas por plan** en el servidor. */
  visitas: VisitasPanel;
  /** La URL absoluta de la carta, que resuelve el servidor. Ver `menuUrl`. */
  menuUrl: string;
  /** El plan efectivo, resuelto en el servidor. Ver `planEfectivoDe`. */
  plan: Plan;
  /** Solo el negocio de prueba: puede cambiarse de plan a voluntad. */
  puedeElegirPlan: boolean;
  /**
   * Los negocios que esta cuenta puede abrir, para el selector de arriba.
   *
   * Con uno solo el selector no se pinta; con dos o más —el propio y el de
   * prueba— permite cambiar sin salir del panel. `place.id` ya dice cuál está
   * activo, así que la lista no repite esa información.
   */
  negocios: NegocioPanel[];
}) {
  /* `businessName` sale de la ficha que se está viendo y no de `/api/me`: con el
     selector, «la tuya» puede ser el negocio de prueba, y `/api/me` solo conoce
     el que está en `business_owners`. El selector va en `above` —encima de la
     vista— para que siga a las cuatro secciones sin pertenecer a ninguna. */
  return (
    <PanelShell
      businessName={place.name}
      above={<BusinessSwitcher negocios={negocios} seleccionado={place.id} />}
    >
      {(view, setView) => {
        switch (view) {
          case "dashboard":
            return (
              <DashboardView
                place={place}
                stats={stats}
                visitas={visitas}
                menuUrl={menuUrl}
                plan={plan}
                /* El botón de la tarjeta de plan navega dentro del panel, no
                   fuera: la sección de planes es una vista más del armazón. */
                onVerPlanes={() => setView("planes")}
              />
            );
          case "editor":
            /* El plan baja al editor porque «Hoy hay» es una función de pago: los
               interruptores de disponibilidad solo se pintan si entra. El
               servidor lo vuelve a comprobar de todas formas.

               La `key` remonta el editor al cambiar de negocio: siembra su
               estado del `place` y a propósito **no** lo resincroniza —eso
               borraría lo escrito en cada `router.refresh()`—, así que sin ella
               cambiar de negocio dejaría en el formulario los datos del
               anterior. */
            return <EditorView key={place.id} place={place} plan={plan} />;
          case "planes":
            return (
              <PlansSection
                key={place.id}
                plan={plan}
                negocio={place.name}
                placeId={place.id}
                puedeElegirPlan={puedeElegirPlan}
              />
            );
          case "settings":
            return (
              <SettingsView
                key={place.id}
                place={place}
                plan={plan}
                onVerPlanes={() => setView("planes")}
              />
            );
        }
      }}
    </PanelShell>
  );
}

/** Encabezado de sección del panel. */
function ViewLead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-gap-md">
      <h1 className="sr-only">{title}</h1>
      <p className="text-small text-ink-soft/75">{subtitle}</p>
    </div>
  );
}

/**
 * Aviso de que la ficha todavía no está publicada.
 *
 * Va en el panel y no solo en el perfil a propósito: el dueño entra aquí a
 * rellenar su negocio y es donde se preguntaría por qué no aparece en el mapa.
 * Decirlo aquí responde a la pregunta en el sitio donde se la hace.
 */
function DashboardView({
  place,
  stats,
  visitas,
  menuUrl,
  plan,
  onVerPlanes,
}: {
  place: UserPlace;
  stats: PlaceStats;
  visitas: VisitasPanel;
  menuUrl: string;
  plan: Plan;
  onVerPlanes: () => void;
}) {
  const offering = [place.description].filter(Boolean).join(" ");

  return (
    <>
      <ViewLead
        title="Dashboard"
        subtitle={`Resumen de ${place.name}`}
      />

      {/* Tres cifras y ninguna inventada. Aquí había «342 visitas esta semana,
          +18%», «87 clics en Cómo llegar» y «156 recomendaciones IA»: no existe
          ninguna tabla que registre visitas, clics ni recomendaciones, así que
          no había forma de calcularlas y estaban escritas a mano. Se enseñan las
          tres que sí salen de la base —una métrica que no se puede comprobar no
          es una métrica— y en su lugar va lo que el dueño puede hacer. */}
      <DashboardStats
        stats={[
          { label: "Guardados", value: String(stats.saved) },
          { label: "Reseñas", value: String(stats.reviews) },
          { label: "Fotos", value: String(stats.photos) },
          { label: "Valoración", value: place.rating ? place.rating.toFixed(1) : "—" },
        ]}
      />

      {/* Las visitas van justo debajo de los números de la ficha: son la otra
          mitad de «cómo va mi negocio», y el candado de los planes de arriba
          está a un clic. */}
      <EstadisticasPanel
        plan={plan}
        visitas={visitas}
        onVerPlanes={onVerPlanes}
      />

      <div className="mt-gap-lg grid grid-cols-1 gap-gap-md lg:grid-cols-2">
        <section className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
          <h2 className="mb-gap-sm font-lv-display text-body font-semibold text-ink">
            Cómo apareces
          </h2>
          <dl className="flex flex-col gap-gap-xs text-small">
            <Row label="Nombre" value={place.name} />
            <Row label="Categoría" value={place.category} />
            <Row label="Zona" value={place.barrio || "Sin barrio"} />
            <Row
              label="Punto en el mapa"
              value={formatCoordinates({ lat: place.lat, lng: place.lng })}
            />
            <Row label="Ficha publicada" value={place.isActive ? "Sí" : "Todavía no"} />
          </dl>
        </section>

        <section className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
          <h2 className="mb-gap-sm font-lv-display text-body font-semibold text-ink">
            Lo que puedes hacer ahora
          </h2>
          <ul className="flex flex-col gap-gap-xs text-small text-ink-soft">
            {stats.photos === 0 && (
              <li>
                <span className="font-semibold text-ink">Sube tus primeras fotos.</span>{" "}
                Un negocio sin fotos se ve mucho menos que uno con tres o cuatro.
              </li>
            )}
            {!offering && (
              <li>
                <span className="font-semibold text-ink">Escribe tu descripción.</span>{" "}
                Es el texto que el buscador usa para recomendarte.
              </li>
            )}
            {place.payments.length === 0 && (
              <li>
                <span className="font-semibold text-ink">Marca qué monedas aceptas.</span>{" "}
                Es uno de los filtros que más se usan al buscar.
              </li>
            )}
            {place.menu.length === 0 && (
              <li>
                <span className="font-semibold text-ink">Publica tu carta.</span>{" "}
                Se añade en «Lo que ofreces» y se comparte con un enlace que
                cualquiera abre, sin cuenta.
              </li>
            )}
            <li>
              <span className="font-semibold text-ink">Revisa tu ficha.</span>{" "}
              Ábrela en el mapa y mírala tal como la ve quien te busca.
            </li>
          </ul>
        </section>

        {/* La marca del QR la decide el plan. Se deriva de `incluye` y no se
            consulta al servidor: es cosmético, no un permiso que escriba nada,
            y el plan ya viene resuelto desde `/business/page.tsx`. */}
        <MenuLinkCard
          placeId={place.id}
          placeName={place.name}
          url={menuUrl}
          sinMarca={incluye(plan, "menu_qr_sin_marca")}
        />

        <PlanCard plan={plan} onVerPlanes={onVerPlanes} />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-gap-sm border-b border-ink/5 py-gap-xs last:border-b-0">
      <dt className="text-ink-soft/75">{label}</dt>
      <dd className="truncate text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function EditorView({ place, plan }: { place: UserPlace; plan: Plan }) {
  const router = useRouter();
  const { categories, updatePlace } = usePlaces();
  const canHoyHay = incluye(plan, "hoy_hay");

  /* El estado se siembra del negocio y no se vuelve a sincronizar: a partir de
     aquí manda lo que escriba el dueño. Sincronizarlo con el `place` que llega
     del servidor borraría lo escrito cada vez que `router.refresh()` trae datos
     nuevos. */
  const [name, setName] = useState(place.name);
  const [categoryValue, setCategoryValue] = useState(
    categories.find((c) => c.label === place.category)?.value ?? "",
  );
  const [icon, setIcon] = useState<string | null>(place.icon ?? null);
  const [description, setDescription] = useState(place.description);
  const [address, setAddress] = useState(place.address);
  const [barrio, setBarrio] = useState(place.barrio);
  const [schedule, setSchedule] = useState(place.schedule);
  const [status, setStatus] = useState<PlaceStatus>(place.status);
  const [payments, setPayments] = useState<string[]>(place.payments);
  const [menu, setMenu] = useState(place.menu);
  /* `"sin"` es «prefiero no decirlo», que no es un valor del dominio sino la
     opción vacía del `Select` —Radix no admite un `SelectItem` con valor `""`—.
     Al guardar se traduce a `null`, que es lo que la base entiende por «no lo
     dijo». */
  const [energia, setEnergia] = useState<EnergiaRespaldo | "sin">(
    place.energiaRespaldo ?? "sin",
  );
  const [notaApagon, setNotaApagon] = useState(place.notaApagon ?? "");
  const [offerEnabled, setOfferEnabled] = useState(Boolean(place.offer));
  const [offerText, setOfferText] = useState(place.offer?.text ?? "");
  const [offerExpiry, setOfferExpiry] = useState(place.offer?.expiry ?? "");
  const [location, setLocation] = useState<LocationPoint | null>({ lat: place.lat, lng: place.lng });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryLabel = categories.find((c) => c.value === categoryValue)?.label ?? place.category;
  const resolvedIcon = placeIcon(icon ?? undefined, categoryLabel, categories);

  const save = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(
        "El nombre del negocio no puede quedar vacío. Está en «Información básica».",
      );
      return;
    }
    if (!location) {
      setError(
        "Marca tu negocio en el mapa antes de guardar. Está en «Ubicación en el mapa».",
      );
      return;
    }

    setError(null);
    setSaving(true);

    const values: UserPlacePatch = {
      name: trimmed,
      category: categoryLabel,
      icon: icon ?? undefined,
      description: description.trim(),
      address: address.trim(),
      barrio: barrio.trim(),
      lat: location.lat,
      lng: location.lng,
      schedule: schedule.trim(),
      status,
      payments,
      /* `tag`, `image` y `category` van con el resto: esto es una lista blanca
         de campos escrita a mano, así que lo que no se nombre aquí se pierde en
         cada guardado —la chapita y la foto ya se perdieron una vez—. */
      menu: menu
        .filter((item) => item.name.trim().length > 0)
        .map((item) => ({
          /* `id` se persiste: es lo que permite señalar un producto concreto
             desde `setDisponibilidad` —y desde el asistente de Telegram— sin
             depender de su posición. Los tres campos de «Hoy hay» van aquí para
             que un guardado normal no los borre: la lista es una lista blanca. */
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          currency: item.currency,
          tag: item.tag,
          category: item.category?.trim() || undefined,
          image: item.image || undefined,
          disponibilidad: item.disponibilidad,
          agotadoHasta: item.agotadoHasta ?? null,
        })),
      offer:
        offerEnabled && offerText.trim()
          ? { text: offerText.trim(), expiry: offerExpiry.trim() }
          : null,
      /* La energía va aquí por lo mismo que la disponibilidad: es una lista
         blanca y lo que no se nombre se pierde en cada guardado. */
      energiaRespaldo: energia === "sin" ? null : energia,
      notaApagon: notaApagon.trim(),
    };

    const saved = await updatePlace(place.id, values);
    setSaving(false);

    if (!saved) {
      setError("No se pudo guardar. Revisa la conexión e inténtalo otra vez: no se cambió nada.");
      return;
    }

    /* Recién escrito en la base: las fotos del menú que quedaron fuera de este
       guardado se retiran del bucket. Antes de aquí no, por lo que explica
       `pruneMenuImages`. */
    pruneMenuImages(place.id, place.menu, values.menu ?? []);

    toast.success("Cambios guardados");
    /* El servidor vuelve a leer la ficha para el dashboard, que es de servidor.
       El formulario no se resiembra —su estado es del cliente y ya tiene lo que
       acabas de escribir—, así que no se pierde nada. */
    router.refresh();
  }, [
    name,
    categoryLabel,
    icon,
    description,
    address,
    barrio,
    location,
    schedule,
    status,
    payments,
    menu,
    energia,
    notaApagon,
    offerEnabled,
    offerText,
    offerExpiry,
    place.id,
    updatePlace,
    router,
  ]);

  return (
    <>
      <ViewLead
        title="Editar ficha"
        subtitle={`${place.name}${place.barrio ? `, ${place.barrio}` : ""}`}
      />

      <FormSections>
        <FormSection title="Fotos del lugar" icon={<ImageIcon size={18} strokeWidth={1.8} />}>
          <PhotoGrid placeId={place.id} placeName={name || place.name} />
        </FormSection>

        <FormSection title="Información básica" icon={<UserIcon size={18} strokeWidth={1.8} />}>
          <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizName">Nombre del negocio</Label>
              <Input
                id="bizName"
                className={INPUT}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre que aparece en La Verde"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizCategory">Categoría</Label>
              <Select value={categoryValue} onValueChange={setCategoryValue}>
                <SelectTrigger id="bizCategory">
                  <SelectValue placeholder="Elige una" />
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
            <div className="flex flex-col gap-gap-xs lg:col-span-2">
              <Label htmlFor="bizDesc">Descripción</Label>
              <textarea
                id="bizDesc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe tu negocio: es el texto que el buscador usa para recomendarte."
                className="flex h-auto min-h-[100px] w-full resize-y rounded-xl border border-ink/10 bg-white px-4 py-3 text-body leading-relaxed text-ink outline-none transition-colors duration-500 ease-outquint placeholder:text-ink-soft/75 focus:border-verde-400 focus:ring-2 focus:ring-verde-400/30"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizAddress">Dirección</Label>
              <Input
                id="bizAddress"
                className={INPUT}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección completa"
              />
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizBarrio">Barrio / Municipio</Label>
              <Input
                id="bizBarrio"
                className={INPUT}
                value={barrio}
                onChange={(e) => setBarrio(e.target.value)}
                placeholder="Ej: Centro histórico"
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Ubicación en el mapa"
          icon={<MapPin size={18} strokeWidth={1.8} />}
        >
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            Busca tu dirección, elige la coincidencia y ajusta el pin. Ese punto
            es el que ven los usuarios cuando piden cómo llegar.
          </p>
          <MapLocationPicker
            value={location}
            onChange={setLocation}
            onResolved={(r) => {
              if (!r) return;
              setAddress((prev) =>
                prev.trim() === "" || !/e\/|entre/i.test(prev) ? r.address : prev,
              );
              setBarrio((prev) => (prev.trim() ? prev : r.barrio));
            }}
          />
        </FormSection>

        <FormSection
          title="Icono del negocio"
          icon={<CategoryIcon icon={resolvedIcon} size={18} strokeWidth={1.8} />}
        >
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            Es el dibujo que llevas en el pin del mapa, en el popup y en tu
            tarjeta. Mientras no elijas uno llevas el de tu categoría.
          </p>
          <IconPicker
            value={resolvedIcon}
            onChange={setIcon}
            label="Icono del negocio"
            preview={name || "Tu negocio"}
          />
          {icon !== null && (
            <button
              type="button"
              onClick={() => setIcon(null)}
              className="mt-gap-sm cursor-pointer self-start font-lv-display text-meta font-semibold text-verde-600 transition-colors duration-500 ease-outquint hover:text-verde-700"
            >
              Usar el de mi categoría
            </button>
          )}
        </FormSection>

        <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
          <FormSection title="Horario" icon={<Clock size={18} strokeWidth={1.8} />}>
            {/* Aquí había un `HoursEditor` con un horario por día que **no se
                guardaba en ninguna parte**: la tabla `place_hours` existe, pero
                no hay ruta que la escriba, así que el dueño lo editaba y se
                perdía al recargar. Se usa el horario en texto, que sí tiene
                columna (`places.schedule`) y sí se guarda. El editor por día
                vuelve el día que exista dónde guardarlo. */}
            <div className="flex flex-col gap-gap-sm">
              <div className="flex flex-col gap-gap-xs">
                <Label htmlFor="bizSchedule">Horario de atención</Label>
                <Input
                  id="bizSchedule"
                  className={INPUT}
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
                    aria-pressed={schedule === preset}
                    className={cn(
                      "cursor-pointer select-none rounded-full border px-[14px] py-2 font-lv-display text-meta font-medium transition-all duration-500 ease-outquint active:scale-[0.98]",
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

          <FormSection
            title="Métodos de pago"
            icon={<CreditCard size={18} strokeWidth={1.8} />}
          >
            <p className="mb-gap-sm text-meta text-ink-soft/75">
              Las monedas y métodos que aceptas. Aparecen en tu ficha y en los filtros.
            </p>
            <PaymentChips defaultSelected={place.payments} onChange={setPayments} />
          </FormSection>
        </div>

        <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
          <FormSection title="Lo que ofreces" icon={<Utensils size={18} strokeWidth={1.8} />}>
            <p className="mb-gap-sm text-meta text-ink-soft/75">
              Tus productos o servicios más populares. Aparecen en la ficha del lugar.
            </p>
            <MenuItemEditor
              placeId={place.id}
              canHoyHay={canHoyHay}
              /* Se conserva el `id` guardado y solo se recurre al índice para
                 las entradas viejas que todavía no tienen uno: regenerarlo en
                 cada carga cambiaría el identificador que el asistente usa. */
              items={(place.menu ?? []).map((m, i) => ({ ...m, id: m.id ?? String(i) }))}
              onChange={setMenu}
            />
          </FormSection>

          <FormSection title="Oferta especial" icon={<Tag size={18} strokeWidth={1.8} />}>
            <div className="flex items-center justify-between gap-gap-sm border-b border-ink/5 py-gap-sm">
              <div className="min-w-0 flex-1">
                <div className="text-small font-medium text-ink">Oferta activa</div>
                <div className="text-meta text-ink-soft/75">
                  Muestra un banner de oferta en tu ficha
                </div>
              </div>
              <Switch
                checked={offerEnabled}
                onToggle={() => setOfferEnabled((prev) => !prev)}
                label="Oferta activa"
              />
            </div>
            <AnimatePresence initial={false}>
              {offerEnabled && (
                <motion.div
                  key="offer-fields"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-gap-sm space-y-gap-xs">
                    <div className="flex flex-col gap-gap-xs">
                      <Label htmlFor="offerTitle">Texto de la oferta</Label>
                      <Input
                        id="offerTitle"
                        className={INPUT}
                        value={offerText}
                        onChange={(e) => setOfferText(e.target.value)}
                        placeholder="Ej: 2x1 en bebidas, Almuerzo del día..."
                      />
                    </div>
                    <div className="flex flex-col gap-gap-xs">
                      <Label htmlFor="offerExpiry">Válido hasta</Label>
                      <Input
                        id="offerExpiry"
                        className={INPUT}
                        value={offerExpiry}
                        onChange={(e) => setOfferExpiry(e.target.value)}
                        placeholder="Ej: 31 de agosto, 2026"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </FormSection>
        </div>

        <FormSection
          title="Energía de respaldo"
          icon={<Zap size={18} strokeWidth={1.8} />}
        >
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            Cuando se va la luz, ¿qué tienes para seguir? Se enseña en tu ficha y
            en tu pin del mapa, y quien busque «con corriente» te encuentra por
            esto. Si no lo rellenas, no se dice nada — un hueco no es lo mismo
            que un «no».
          </p>
          <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizEnergia">Respaldo</Label>
              <Select
                value={energia}
                onValueChange={(value) =>
                  setEnergia(value as EnergiaRespaldo | "sin")
                }
              >
                <SelectTrigger id="bizEnergia">
                  <SelectValue placeholder="Elige" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin">Prefiero no decirlo</SelectItem>
                  {ENERGIA_ORDER.map((valor) => (
                    <SelectItem key={valor} value={valor}>
                      {ENERGIA_LABEL[valor]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="bizNotaApagon">Cómo lo llevas (opcional)</Label>
              <Input
                id="bizNotaApagon"
                className={INPUT}
                maxLength={140}
                value={notaApagon}
                onChange={(e) => setNotaApagon(e.target.value)}
                placeholder="Ej: la planta cubre el salón y la cocina"
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Estado del negocio" icon={<Store size={18} strokeWidth={1.8} />}>
          <p className="mb-gap-sm text-meta text-ink-soft/75">
            Si ahora mismo estás abierto. La ficha se sigue viendo aunque estés
            cerrado —los enlaces se comparten— pero avisa de que no abres.
          </p>
          <div className="flex flex-col gap-gap-xs">
            <Label htmlFor="bizStatus">Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PlaceStatus)}>
              <SelectTrigger id="bizStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="inline-flex flex-col">
                      <span>{s.label}</span>
                      <span className="text-meta text-ink-soft/75">{s.hint}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aquí estaba el bloque «Destacar en La Verde», con un precio de 25
              USD al mes y un botón «Activar destacado» que no hacía nada: no hay
              pasarela de pago ni forma de cobrar. Un botón que promete cobrar y
              no cobra es peor que no tenerlo, así que se retira entero. El campo
              `isBoosted` sigue en la base y lo pone la administración. */}
        </FormSection>

        <AnimatePresence>
          {error && (
            <motion.p
              key="biz-error"
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-destructive"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </FormSections>

      {/* La barra de guardado pegada abajo. Antes no había forma de saber si los
          cambios se habían escrito: el `SaveBar` que había publicaba contra
          nada. Este llama al `PATCH` de verdad y avisa cuando el servidor
          confirma. */}
      <div className="sticky bottom-dock-clear z-40 mt-gap-lg flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-12 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        >
          {saving ? (
            <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <Save size={16} strokeWidth={1.8} />
          )}
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </>
  );
}

/**
 * Los ajustes del negocio.
 *
 * Antes esto era una ficha de solo lectura —nombre, categoría, plan— que no
 * hacía nada: lo que se venía a cambiar aquí vivía en «Editar ficha», y para
 * apagar una sola cosa había que abrir el formulario entero y guardarlo todo.
 * Ahora hay dos bloques que **escriben de verdad**, y el interruptor escribe al
 * momento, que es lo que se espera de unos ajustes.
 *
 * Solo hay aquí lo que tiene columna detrás. Estuvieron los tres interruptores
 * de «Notificaciones», «Recomendaciones IA» y «Mostrar horarios», que se movían
 * y se perdían al recargar porque no había dónde guardarlos: un interruptor que
 * miente es peor que no tenerlo, y no vuelven hasta que exista su tabla.
 */
function SettingsView({
  place,
  plan,
  onVerPlanes,
}: {
  place: UserPlace;
  plan: Plan;
  /** Lleva a la sección «Planes» cuando la función no entra en el plan. */
  onVerPlanes: () => void;
}) {
  const { updatePlace } = usePlaces();

  const [pedidos, setPedidos] = useState(place.pedidosWhatsapp);
  const [cambiandoPedidos, setCambiandoPedidos] = useState(false);
  const [whatsapp, setWhatsapp] = useState(place.whatsapp ?? "");
  const [phone, setPhone] = useState(place.phone ?? "");
  const [website, setWebsite] = useState(place.website ?? "");
  const [instagram, setInstagram] = useState(place.instagram ?? "");
  const [facebook, setFacebook] = useState(place.facebook ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* `null` si el plan ya lo incluye. Es el mismo texto que usa el candado de
     «Hoy hay»: una sola forma de decir «esto se sube de plan». */
  const bloqueo = textoBloqueo("whatsapp_pedido", plan);
  const tieneNumero = Boolean(whatsapp.trim());

  /**
   * El interruptor escribe al momento.
   *
   * Optimista y con vuelta atrás: se pinta el estado nuevo, se manda, y si el
   * servidor dice que no se devuelve el interruptor a donde estaba. Dejar el
   * interruptor en «sí» tras un guardado fallido sería peor que no moverse —
   * el dueño creería que sus pedidos están encendidos y no lo están.
   */
  async function alternarPedidos() {
    if (bloqueo || cambiandoPedidos) return;
    const siguiente = !pedidos;
    setCambiandoPedidos(true);
    setPedidos(siguiente);

    const guardado = await updatePlace(place.id, { pedidosWhatsapp: siguiente });

    setCambiandoPedidos(false);
    if (!guardado) {
      setPedidos(!siguiente);
      toast.error("No se pudo cambiar. Revisa la conexión: no se cambió nada.");
      return;
    }
    toast.success(
      siguiente
        ? "Pedidos por WhatsApp activados en tu carta."
        : "Pedidos por WhatsApp desactivados. Tu carta sigue igual, sin carrito.",
    );
  }

  /**
   * El contacto se guarda de una vez, con su botón.
   *
   * No es un interruptor y no escribe al teclear: son cinco campos que se
   * escriben a medias, y mandar cada pulsación dejaría la ficha con números
   * incompletos mientras se teclea.
   */
  async function guardarContacto() {
    let numero = "";
    if (whatsapp.trim()) {
      const normalizado = normalizarWhatsappCubano(whatsapp);
      if (!normalizado) {
        setError(
          "Ese WhatsApp no parece cubano. Escríbelo como +53 5 123 4567.",
        );
        return;
      }
      numero = normalizado;
    }

    setError(null);
    setGuardando(true);
    const guardado = await updatePlace(place.id, {
      whatsapp: numero,
      phone: phone.trim(),
      website: website.trim(),
      instagram: instagram.trim(),
      facebook: facebook.trim(),
    });
    setGuardando(false);

    if (!guardado) {
      setError(
        "No se pudo guardar. Revisa la conexión e inténtalo otra vez: no se cambió nada.",
      );
      return;
    }
    /* Se pinta ya normalizado, que es como quedó guardado. */
    setWhatsapp(numero);
    toast.success("Contacto guardado");
  }

  return (
    <>
      <ViewLead title="Ajustes" subtitle="Configuración de tu negocio" />

      <div className="flex flex-1 flex-col gap-gap-md">
        {/* ── Pedidos por WhatsApp ────────────────────────────────────────
            El plan enciende la función y el dueño la apaga a voluntad en su
            carta. Los dos interruptores se enseñan siempre, también cuando el
            plan no llega: si no, el dueño no se entera de que la función
            existe. */}
        <section className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-gap-sm">
            <h2 className="flex items-center gap-gap-xs font-lv-display text-body font-semibold text-ink">
              <MessageCircle size={18} strokeWidth={1.8} className="text-verde-600" />
              Pedidos por WhatsApp
            </h2>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em]",
                bloqueo
                  ? "border border-ink/10 bg-sand text-ink-soft/75"
                  : pedidos
                    ? "border border-verde-200 bg-verde-50 text-verde-700"
                    : "border border-ink/10 bg-sand text-ink-soft/75",
              )}
            >
              {bloqueo ?? (pedidos ? "Activo" : "Desactivado")}
            </span>
          </div>

          <p className="mt-gap-xs max-w-[62ch] text-small text-ink-soft/75">
            Quien abre tu carta añade productos a un carrito y el pedido te llega
            escrito por WhatsApp, con las cantidades y el total. El carrito no
            pasa por La Verde: el mensaje sale de su teléfono al tuyo, y tú
            contestas como siempre.
          </p>

          {bloqueo ? (
            <div className="mt-gap-md flex flex-wrap items-center gap-gap-sm">
              <button
                type="button"
                onClick={onVerPlanes}
                className="inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
              >
                Ver los planes
              </button>
              <p className="text-meta text-ink-soft/75">
                Tu carta se comparte igual; solo le falta el carrito.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-gap-md flex items-center justify-between gap-gap-sm border-t border-ink/5 pt-gap-sm">
                <div className="min-w-0 flex-1">
                  <div className="text-small font-medium text-ink">
                    Recibir pedidos en mi carta
                  </div>
                  <div className="text-meta text-ink-soft/75">
                    {pedidos
                      ? "El carrito aparece en tu menú."
                      : "El carrito está oculto; tus productos se siguen viendo."}
                  </div>
                </div>
                <Switch
                  checked={pedidos}
                  onToggle={() => void alternarPedidos()}
                  label="Recibir pedidos en mi carta"
                />
              </div>

              {/* Con el plan puesto y los pedidos encendidos, el único motivo
                  por el que el carrito no sale es que falte el número. Se dice
                  aquí, que es donde el dueño lo está mirando. */}
              {pedidos && !tieneNumero && (
                <p className="mt-gap-sm rounded-xl border border-amber-200 bg-amber-50 px-3 py-[7px] text-meta font-medium text-amber-800">
                  Falta tu número de WhatsApp: sin él no hay a dónde mandar el
                  pedido y el carrito no se enseña. Añádelo en «Cómo te
                  contactan», aquí abajo.
                </p>
              )}
            </>
          )}
        </section>

        {/* ── Contacto ────────────────────────────────────────────────────
            Los cuatro campos que hasta ahora solo se podían cambiar en el
            formulario de alta del perfil. El número de WhatsApp es el que
            alimenta el bloque de arriba, así que vive pegado a él. */}
        <section className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
          <h2 className="font-lv-display text-body font-semibold text-ink">
            Cómo te contactan
          </h2>
          <p className="mt-gap-xs max-w-[62ch] text-small text-ink-soft/75">
            Esto es lo que sale en tu ficha. Lo que dejes vacío, no se pinta:
            un negocio sin Instagram no tiene por qué enseñar un hueco.
          </p>

          <div className="mt-gap-md grid grid-cols-1 gap-gap-md lg:grid-cols-2">
            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="ajWhatsapp">
                WhatsApp <span className="text-verde-700">(con él llegan los pedidos)</span>
              </Label>
              <Input
                id="ajWhatsapp"
                type="tel"
                autoComplete="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(sanitizePhone(e.target.value))}
                placeholder="+53 5 123 4567"
                className={INPUT}
              />
            </div>

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="ajPhone">Teléfono de la ficha</Label>
              <Input
                id="ajPhone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                placeholder="+53 7 866 1234"
                className={INPUT}
              />
            </div>

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="ajWebsite">Sitio web</Label>
              <Input
                id="ajWebsite"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Ej: https://laverde.cu"
                className={INPUT}
              />
            </div>

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="ajInstagram">Instagram</Label>
              <Input
                id="ajInstagram"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="Ej: @laverde"
                className={INPUT}
              />
            </div>

            <div className="flex flex-col gap-gap-xs">
              <Label htmlFor="ajFacebook">Facebook</Label>
              <Input
                id="ajFacebook"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="Ej: laverde.cu"
                className={INPUT}
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                key="aj-error"
                role="alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="mt-gap-sm rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-destructive"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => void guardarContacto()}
            disabled={guardando}
            className="mt-gap-md inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
          >
            {guardando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Save size={16} strokeWidth={1.8} />
                Guardar contacto
              </>
            )}
          </button>
        </section>

        {/* ── Lo que solo se consulta ─────────────────────────────────────
            Sigue siendo de lectura, y por eso no hay botón: son las cuatro
            respuestas que el dueño viene a buscar aquí. */}
        <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
          <div className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
            <Row label="Nombre del negocio" value={place.name} />
            <Row label="Categoría" value={place.category} />
            <Row label="Ubicación" value={formatCoordinates({ lat: place.lat, lng: place.lng })} />
            <Row label="Ficha publicada" value={place.isActive ? "Sí" : "Todavía no"} />
          </div>

          <div className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
            {/* Estaba escrito a fuego «Básico (gratis)» para todo el mundo. Ahora
                es el plan que hay de verdad, resuelto en el servidor. */}
            <Row label="Plan actual" value={PLAN_LABEL[plan]} />
            <Row label="Contacto de soporte" value={SUPPORT_EMAIL} />
            <Row label="Versión de la ficha" value={place.id} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex h-11 cursor-pointer items-center gap-gap-xs self-start rounded-full px-gap-lg font-lv-display text-small font-semibold text-destructive transition-colors duration-500 ease-outquint hover:bg-destructive/10"
        >
          <LogOut size={18} strokeWidth={1.8} />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}

/** Interruptor del sistema. Estaba duplicado, con las mismas clases, en el
    bloque de oferta y en `ToggleRow`. */
function Switch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn(
        "relative h-[28px] w-[48px] shrink-0 cursor-pointer rounded-full border-none p-0 transition-colors duration-500 ease-outquint",
        checked ? "bg-verde-400" : "bg-ink/10",
      )}
    >
      <span
        className={cn(
          "absolute left-[3px] top-[3px] size-[22px] rounded-full bg-white shadow-soft transition-transform duration-500 ease-outquint",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

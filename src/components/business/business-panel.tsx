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
  Save,
  Store,
  Tag,
  Utensils,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { FormSection } from "@/components/business/form-section";
import { PanelShell } from "@/components/business/panel-shell";
import { DashboardStats } from "@/components/business/dashboard-stats";
import { PhotoGrid } from "@/components/business/photo-grid";
import { PaymentChips } from "@/components/business/payment-chips";
import { MenuItemEditor } from "@/components/business/menu-item-editor";
import { PreviewPanel } from "@/components/business/preview-panel";
import { MapLocationPicker, type LocationPoint } from "@/components/map/MapLocationPicker";
import { usePlaces } from "@/providers/places-provider";
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
export function BusinessPanel({ place, stats }: { place: UserPlace; stats: PlaceStats }) {
  return (
    <PanelShell>
      {(view) => {
        switch (view) {
          case "dashboard":
            return <DashboardView place={place} stats={stats} />;
          case "editor":
            return <EditorView place={place} />;
          case "preview":
            return <PreviewView place={place} />;
          case "settings":
            return <SettingsView place={place} />;
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
function DashboardView({ place, stats }: { place: UserPlace; stats: PlaceStats }) {
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
            <li>
              <span className="font-semibold text-ink">Revisa tu ficha.</span>{" "}
              En «Vista previa» la ves tal como la ve quien te busca.
            </li>
          </ul>
        </section>
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

function EditorView({ place }: { place: UserPlace }) {
  const router = useRouter();
  const { categories, updatePlace } = usePlaces();

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
      setError("El nombre del negocio no puede quedar vacío.");
      return;
    }
    if (!location) {
      setError("Marca tu negocio en el mapa antes de guardar.");
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
    };

    const saved = await updatePlace(place.id, values);
    setSaving(false);

    if (!saved) {
      setError("No se pudo guardar. Revisa la conexión e inténtalo otra vez: no se cambió nada.");
      return;
    }

    toast.success("Cambios guardados");
    /* El servidor vuelve a leer la ficha para el dashboard y la vista previa, que
       son de servidor. El formulario no se resiembra —su estado es del cliente y
       ya tiene lo que acabas de escribir—, así que no se pierde nada. */
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

      <div className="space-y-gap-md">
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
              items={(place.menu ?? []).map((m, i) => ({ ...m, id: String(i) }))}
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
      </div>

      {/* La barra de guardado pegada abajo. Antes no había forma de saber si los
          cambios se habían escrito: el `SaveBar` que había publicaba contra
          nada. Este llama al `PATCH` de verdad y avisa cuando el servidor
          confirma. */}
      <div className="sticky bottom-dock-clear z-40 mt-gap-lg flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-12 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
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

function PreviewView({ place }: { place: UserPlace }) {
  return (
    <>
      <ViewLead title="Vista previa" subtitle="Así se ve tu ficha en La Verde" />
      <PreviewPanel
        businessName={place.name}
        category={place.category}
        payments={place.payments}
        offer={place.offer?.text ?? ""}
        /* `gradient` es el relleno del hueco donde iría la foto del plato: los
           elementos del menú no tienen imagen. Se pone uno fijo del sistema en
           vez de inventar uno por plato — lo que se enseña de verdad son el
           nombre, el precio y la moneda. */
        menuItems={(place.menu ?? []).map((m) => ({
          name: m.name,
          price: m.price,
          currency: m.currency,
          tag: m.tag,
          gradient: "linear-gradient(135deg, #EAF7EF, #CEEEDB)",
        }))}
        menuCount={place.menu?.length ?? 0}
      />
    </>
  );
}

function SettingsView({ place }: { place: UserPlace }) {
  return (
    <>
      <ViewLead title="Ajustes" subtitle="Configuración de tu negocio" />

      <div className="flex flex-1 flex-col">
        <div className="grid grid-cols-1 gap-gap-md lg:grid-cols-2">
          <div className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
            <Row label="Nombre del negocio" value={place.name} />
            <Row label="Categoría" value={place.category} />
            <Row label="Ubicación" value={formatCoordinates({ lat: place.lat, lng: place.lng })} />
            <Row label="Ficha publicada" value={place.isActive ? "Sí" : "Todavía no"} />
          </div>

          {/* Aquí había tres interruptores —«Notificaciones», «Recomendaciones
              IA», «Mostrar horarios»— que no guardaban nada: no hay columna ni
              ruta detrás, así que se movían y se perdían al recargar. Se
              retiran en vez de dejarlos mintiendo. Volverán cuando exista dónde
              escribirlos, y con ellos su ruta. */}
          <div className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
            <Row label="Plan actual" value="Básico (gratis)" />
            <Row label="Contacto de soporte" value="soporte@laverde.cu" />
            <Row label="Versión de la ficha" value={place.id} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-auto inline-flex h-11 cursor-pointer items-center gap-gap-xs self-start rounded-full px-gap-lg font-lv-display text-small font-semibold text-destructive transition-colors duration-500 ease-outquint hover:bg-destructive/10"
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

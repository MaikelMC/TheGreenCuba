"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  User,
  Mail,
  Phone,
  MapPin,
  Heart,
  Music,
  Wallet,
  Store,
  Megaphone,
} from "lucide-react";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { CUBA_PROVINCES, type UserPreferences } from "@/lib/user-preferences-store";
import { focusProfileControl } from "@/components/profile/focus-profile-control";
import { FormSection, FormSections } from "@/components/business/form-section";

const INTERESTS = [
  { value: "cafes", label: "Cafeterías" },
  { value: "restaurantes", label: "Restaurantes" },
  { value: "discotecas", label: "Discotecas" },
  { value: "mercados", label: "Mercados" },
  { value: "bares", label: "Bares & Noche" },
  { value: "playas", label: "Playas" },
  { value: "cultura", label: "Cultura & Arte" },
  { value: "fitness", label: "Deporte & Fitness" },
];

const MOODS = [
  { value: "tranquilo", label: "Tranquilo" },
  { value: "fiesta", label: "Fiesta & Rumba" },
  { value: "romantico", label: "Romántico" },
  { value: "familiar", label: "Familiar" },
  { value: "cultural", label: "Cultural" },
  { value: "aventura", label: "Aventura" },
  { value: "trabajo", label: "Trabajo & Estudio" },
  { value: "salud", label: "Salud & Bienestar" },
];

/* Sin distintivos: el nombre de la divisa ya lo dice todo. "Transferencia" no
   es una moneda en sentido estricto, pero el usuario la marca igual que las
   demás porque es una forma de pago que acepta o no. */
const CURRENCIES = [
  { value: "mlc", label: "USD Clásica" },
  { value: "cup", label: "CUP" },
  { value: "usd", label: "USD" },
  { value: "eur", label: "EUR" },
  { value: "transfer", label: "Transferencia" },
];

type TogglePreference = (listKey: "interests" | "moods" | "currencies", value: string) => void;

interface DetailsViewProps {
  prefs: UserPreferences;
  set: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  hasBusiness: boolean;
  onRegisterBusiness: () => void;
  onRegisterProject: () => void;
}

/** «Info»: los datos de la cuenta y las puertas al alta de negocio o proyecto. */
export function DetailsView({
  prefs,
  set,
  hasBusiness,
  onRegisterBusiness,
  onRegisterProject,
}: DetailsViewProps) {
  return (
    <div className="flex flex-col gap-gap-xl" onPointerDownCapture={focusProfileControl}>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
        }}
        className="flex flex-col gap-gap-md"
      >
        <Section title="Datos personales" icon={User}>
          <Field icon={User} label="Nombre" value={prefs.name} onChange={(v) => set("name", v)} />
          <Field
            icon={Mail}
            label="Correo electrónico"
            value={prefs.email}
            onChange={(v) => set("email", v)}
          />
          <Field
            icon={Phone}
            label="Teléfono"
            value={prefs.phone}
            onChange={(v) => set("phone", v)}
          />
        </Section>

        <Section title="Zona donde te mueves" icon={MapPin}>
          <label className="flex flex-col gap-gap-xs">
            <span className="text-meta text-ink-soft/75">Selecciona tu provincia</span>
            <select
              value={CUBA_PROVINCES.some((province) => province.value === prefs.location) ? prefs.location : ""}
              onChange={(event) => set("location", event.target.value)}
              className="h-12 w-full rounded-xl border border-ink/10 bg-sand px-3 text-small text-ink outline-none transition-colors focus:border-verde-400 focus:bg-white focus:ring-2 focus:ring-verde-400/20"
              aria-label="Provincia donde te mueves"
            >
              <option value="" disabled>Selecciona una provincia</option>
              {CUBA_PROVINCES.map((province) => (
                <option key={province.value} value={province.value}>{province.label}</option>
              ))}
            </select>
            <span className="text-meta text-ink-soft/60">
              Si la ubicación automática falla, puedes elegirla manualmente.
            </span>
          </label>
          {prefs.location === "santiago" && (
            <p className="text-meta text-ink-soft/60">Ubicación antigua detectada: Santiago de Cuba. Selecciona la provincia para actualizarla.</p>
          )}
          {prefs.location === "varadero" && (
            <p className="text-meta text-ink-soft/60">Ubicación antigua detectada: Matanzas. Selecciona la provincia para actualizarla.</p>
          )}
        </Section>

        <Section title="Tu negocio" icon={Store}>
          <div className="grid grid-cols-2 gap-gap-sm">
            <EntryCard
              icon={Store}
              title={hasBusiness ? "Gestionar mi negocio" : "Registrar negocio"}
              description={
                hasBusiness
                  ? "Tu ficha, su estado y el acceso al panel."
                  : "Local permanente con ficha y horarios."
              }
              onClick={onRegisterBusiness}
            />
            <EntryCard
              icon={Megaphone}
              title="Registrar proyecto"
              description="Evento o actividad con fecha y reservas."
              onClick={onRegisterProject}
            />
          </div>
        </Section>
      </motion.div>
    </div>
  );
}

/** Las preferencias de descubrimiento, que viven en «Sobre mí» desde que esa
    sección recogió lo que antes estaba repartido por «Perfil». Se exporta para
    que el armazón de «Sobre mí» las pinte con el mismo estado que guarda.

    Van plegadas: son tres bloques de chips y, abiertos, empujaban la actividad
    —lo que se viene a mirar— muy por debajo. Se reutiliza el acordeón del
    formulario de negocio para no tener dos maneras de desplegar una sección. */
export function PreferenceSections({
  prefs,
  toggle,
}: {
  prefs: UserPreferences;
  toggle: TogglePreference;
}) {
  return (
    <FormSections>
      <FormSection
        title="Lugares que te gustan"
        icon={<Heart size={18} strokeWidth={1.8} />}
      >
        <div className="flex flex-wrap gap-gap-xs">
          {INTERESTS.map((it) => (
            <Chip
              key={it.value}
              selected={prefs.interests.includes(it.value)}
              onClick={() => toggle("interests", it.value)}
              label={it.label}
            />
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Ambientes que buscas"
        icon={<Music size={18} strokeWidth={1.8} />}
      >
        <div className="flex flex-wrap gap-gap-xs">
          {MOODS.map((m) => (
            <Chip
              key={m.value}
              selected={prefs.moods.includes(m.value)}
              onClick={() => toggle("moods", m.value)}
              label={m.label}
            />
          ))}
        </div>
      </FormSection>

      <FormSection title="Monedas que usas" icon={<Wallet size={18} strokeWidth={1.8} />}>
        <div className="flex flex-wrap gap-gap-xs">
          {CURRENCIES.map((c) => (
            <Chip
              key={c.value}
              selected={prefs.currencies.includes(c.value)}
              onClick={() => toggle("currencies", c.value)}
              label={c.label}
            />
          ))}
        </div>
      </FormSection>
    </FormSections>
  );
}

/* Tarjeta compacta de entrada a un alta. Dos en fila, con la información justa
   para elegir: qué es y a dónde lleva. */
function EntryCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Store;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[118px] flex-col items-start justify-between rounded-2xl border border-ink/10 bg-white p-gap-sm text-left text-ink shadow-soft transition duration-500 ease-outquint hover:border-verde-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
    >
      <span className="flex flex-col gap-gap-xs">
        <span className="grid size-8 place-items-center rounded-xl bg-verde-50 text-verde-700">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span className="font-lv-display text-small font-semibold leading-tight">
          {title}
        </span>
        <span className="text-meta leading-snug text-ink-soft/75">{description}</span>
      </span>
      <span className="mt-gap-xs inline-flex items-center gap-[3px] text-meta font-semibold text-verde-700">
        Empezar
        <ArrowRight
          size={13}
          className="transition-transform duration-500 group-hover:translate-x-0.5"
        />
      </span>
    </button>
  );
}

/* Tarjeta de sección, igual que la del editor de la ficha de negocio. El
   título va en el eyebrow del sistema —10 px, mayúsculas, tracking ancho—
   porque el nombre de la sección es una etiqueta, no un titular. */
function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof MapPin;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-gap-md rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
      <h2 className="flex items-center gap-gap-xs font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
        <Icon size={14} strokeWidth={1.8} className="shrink-0" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Chip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-[6px] rounded-full border px-[14px] py-2 font-lv-display text-small font-medium transition duration-500 ease-outquint active:scale-[0.98]",
        selected
          ? "border-verde-400 bg-verde-400 text-verde-950 shadow-soft"
          : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full transition-colors duration-500 ease-outquint",
          selected ? "bg-verde-950/50" : "bg-sand-deep",
        )}
      />
      {label}
    </button>
  );
}

/* El `label` envuelve al `input`: asociación implícita del propio HTML, sin
   `htmlFor` ni `id` que mantener. Antes el `Label` era un `<label>` suelto
   sin asociar, así que el campo no tenía nombre accesible. */
function Field({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: typeof User;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <motion.label
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
      }}
      className="flex flex-col gap-gap-xs"
    >
      <span className="font-lv-display text-meta text-ink-soft/75">{label}</span>
      <span className="flex items-center gap-gap-sm rounded-xl border border-ink/10 bg-white px-gap-sm py-[10px] transition-colors duration-500 ease-outquint focus-within:border-verde-400 focus-within:ring-2 focus-within:ring-verde-400/20">
        <Icon size={16} strokeWidth={1.8} className="shrink-0 text-ink-soft/75" />
        {/* `min-w-0`: un `<input>` es elemento de reemplazo y como ítem de flex
            no baja de su ancho intrínseco sin él. */}
        <input
          className="min-w-0 flex-1 bg-transparent text-small text-ink outline-none placeholder:text-ink-soft/75"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </motion.label>
  );
}

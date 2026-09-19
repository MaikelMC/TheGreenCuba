"use client";

import { motion } from "motion/react";
import { Save, User, Mail, Phone, MapPin, Heart, Music, Wallet } from "lucide-react";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { UserPreferences } from "@/lib/user-preferences-store";

const LOCATIONS = [
  { value: "la-habana", label: "La Habana" },
  { value: "santiago", label: "Santiago de Cuba" },
  { value: "varadero", label: "Varadero" },
  { value: "otra", label: "Otra ciudad" },
];

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

/* El halo del botón primario del sistema. Vive suelto porque lo usa el botón
   del final del formulario; el de la cabecera se lo pone el armazón. */
const SAVE_BTN =
  "bg-verde-400 text-verde-950 shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] hover:bg-verde-300 transition-all duration-500 ease-outquint font-lv-display font-semibold cursor-pointer";

interface DetailsViewProps {
  prefs: UserPreferences;
  set: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  toggle: (listKey: "interests" | "moods" | "currencies", value: string) => void;
  onSave: () => void;
  saved: boolean;
}

/** «Perfil»: el formulario de preferencias, tal cual estaba en la página. */
export function DetailsView({ prefs, set, toggle, onSave, saved }: DetailsViewProps) {
  const { name } = prefs;

  return (
    <div className="flex flex-col gap-gap-xl">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="flex flex-col items-center gap-gap-sm"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
          className="grid size-20 place-items-center rounded-full border-2 border-verde-200 bg-verde-50 font-lv-display text-2xl font-bold text-verde-600"
        >
          {name.charAt(0)}
        </motion.div>
        <p className="text-meta text-ink-soft/75">Foto de perfil</p>
      </motion.div>

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
          <div className="grid grid-cols-2 gap-gap-xs">
            {LOCATIONS.map((loc) => (
              <Chip
                key={loc.value}
                selected={prefs.location === loc.value}
                onClick={() => set("location", loc.value)}
                label={loc.label}
              />
            ))}
          </div>
        </Section>

        <Section title="Lugares que te gustan" icon={Heart}>
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
        </Section>

        <Section title="Ambiente que buscas" icon={Music}>
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
        </Section>

        <Section title="Monedas que usas" icon={Wallet}>
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
        </Section>

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={onSave}
          className={cn(
            SAVE_BTN,
            "flex h-12 w-full items-center justify-center gap-gap-xs rounded-full text-body",
          )}
        >
          <motion.span
            key={saved ? "saved-cta" : "save-cta"}
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="inline-flex items-center gap-[6px]"
          >
            <Save size={16} strokeWidth={1.8} />
            {saved ? "Preferencias guardadas" : "Guardar cambios"}
          </motion.span>
        </motion.button>
      </motion.div>
    </div>
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
        "inline-flex cursor-pointer select-none items-center gap-[6px] rounded-full border px-[14px] py-2 font-lv-display text-small font-medium transition-all duration-500 ease-outquint active:scale-[0.98]",
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

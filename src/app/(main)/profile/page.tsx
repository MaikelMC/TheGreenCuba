"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Phone,
  MapPin,
  Heart,
  Music,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EASE } from "@/lib/motion";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";
import {
  readUserPreferences,
  writeUserPreferences,
  locationLabel,
  type UserPreferences,
} from "@/lib/user-preferences-store";

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

const CURRENCIES = [
  { value: "mlc", label: "USD Clásica", badge: "Popular" },
  { value: "cup", label: "CUP", badge: "Nacional" },
  { value: "usd", label: "USD", badge: "Internacional" },
  { value: "eur", label: "EUR", badge: "Internacional" },
];

export default function ProfilePage() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(readUserPreferences());
  }, []);

  if (!prefs) {
    return (
      <div className="min-h-dvh bg-background" aria-busy>
        <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-surface/80 backdrop-blur-md px-4 h-14">
          <Link
            href="/home"
            className="size-8 grid place-items-center rounded-lg hover:bg-accent/10 transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </Link>
          <h1 className="font-display font-semibold text-base">Perfil</h1>
        </div>
      </div>
    );
  }

  function set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
  }

  function toggle(listKey: "interests" | "moods" | "currencies", value: string) {
    setPrefs((p) => {
      if (!p) return p;
      const next = p[listKey].includes(value)
        ? p[listKey].filter((v) => v !== value)
        : [...p[listKey], value];
      return { ...p, [listKey]: next };
    });
  }

  function handleSave() {
    if (!prefs) return;
    writeUserPreferences({
      ...prefs,
      onboardingCompleted: true,
      locationName: locationLabel(prefs.location),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const { name } = prefs;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-surface/80 backdrop-blur-md px-4 h-14">
        <Link
          href="/home"
          className="size-8 grid place-items-center rounded-lg hover:bg-accent/10 transition-colors"
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
        </Link>
        <h1 className="font-display font-semibold text-base">Perfil</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={handleSave}>
            <motion.span
              key={saved ? "saved" : "save"}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="inline-flex items-center gap-1.5"
            >
              <Save size={14} strokeWidth={2} />
              {saved ? "Guardado" : "Guardar"}
            </motion.span>
          </Button>
          <UserMenu initial={name.charAt(0)} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-8 pb-20 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
            className="size-20 rounded-full bg-accent/10 border-2 border-border grid place-items-center text-accent font-display font-bold text-2xl"
          >
            {name.charAt(0)}
          </motion.div>
          <p className="text-small text-muted">Foto de perfil</p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
          }}
          className="space-y-8"
        >
          {/* Identidad */}
          <section className="space-y-5">
            <SectionTitle>Datos personales</SectionTitle>
            <Field
              icon={User}
              label="Nombre"
              value={prefs.name}
              onChange={(v) => set("name", v)}
            />
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
          </section>

          {/* Zona */}
          <section className="space-y-3">
            <SectionTitle icon={MapPin}>Zona donde te mueves</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {LOCATIONS.map((loc) => (
                <Chip
                  key={loc.value}
                  selected={prefs.location === loc.value}
                  onClick={() => set("location", loc.value)}
                  label={loc.label}
                />
              ))}
            </div>
          </section>

          {/* Intereses */}
          <section className="space-y-3">
            <SectionTitle icon={Heart}>Lugares que te gustan</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((it) => (
                <Chip
                  key={it.value}
                  selected={prefs.interests.includes(it.value)}
                  onClick={() => toggle("interests", it.value)}
                  label={it.label}
                />
              ))}
            </div>
          </section>

          {/* Ambientes */}
          <section className="space-y-3">
            <SectionTitle icon={Music}>Ambiente que buscas</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <Chip
                  key={m.value}
                  selected={prefs.moods.includes(m.value)}
                  onClick={() => toggle("moods", m.value)}
                  label={m.label}
                />
              ))}
            </div>
          </section>

          {/* Monedas */}
          <section className="space-y-3">
            <SectionTitle icon={Wallet}>Monedas que usas</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => (
                <Chip
                  key={c.value}
                  selected={prefs.currencies.includes(c.value)}
                  onClick={() => toggle("currencies", c.value)}
                  label={c.label}
                  badge={c.badge}
                />
              ))}
            </div>
          </section>

          <Button className="w-full" size="lg" onClick={handleSave}>
            <motion.span
              key={saved ? "saved-cta" : "save-cta"}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="inline-flex items-center gap-1.5"
            >
              <Save size={16} strokeWidth={2} />
              {saved ? "Preferencias guardadas" : "Guardar cambios"}
            </motion.span>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function SectionTitle({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: typeof MapPin;
}) {
  return (
    <h2 className="flex items-center gap-2 font-display font-semibold text-[15px] text-foreground">
      {Icon && <Icon size={16} strokeWidth={1.5} className="text-accent" />}
      {children}
    </h2>
  );
}

function Chip({
  selected,
  onClick,
  label,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[13px] font-medium transition-all duration-200",
        selected
          ? "bg-accent/10 border-accent text-accent"
          : "border-border bg-surface text-muted-foreground hover:border-accent hover:text-accent",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full transition-colors",
          selected ? "bg-accent" : "bg-border",
        )}
      />
      {label}
      {badge && (
        <span className="text-[10px] uppercase tracking-wide text-muted">{badge}</span>
      )}
    </button>
  );
}

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
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
      }}
      className="space-y-1.5"
    >
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-lv-lg border border-border bg-surface px-3 py-2.5 focus-within:border-accent transition-colors">
        <Icon size={16} strokeWidth={1.5} className="text-muted shrink-0" />
        <input
          className="flex-1 bg-transparent text-small text-foreground outline-none placeholder:text-muted"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </motion.div>
  );
}
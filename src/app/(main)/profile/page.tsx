"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, User, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserMenu } from "@/components/layout/user-menu";

const initialProfile = {
  name: "Martín",
  email: "martin@email.com",
  phone: "+52 55 1234 5678",
  location: "Ciudad de México",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

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
            {saved ? "Guardado" : "Guardar"}
          </Button>
          <UserMenu initial={profile.name.charAt(0)} />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-8 pb-20 space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="size-20 rounded-full bg-accent/10 border-2 border-border grid place-items-center text-accent font-display font-bold text-2xl">
            {profile.name.charAt(0)}
          </div>
          <p className="text-small text-muted">Foto de perfil</p>
        </div>

        <div className="space-y-5">
          <Field
            icon={User}
            label="Nombre"
            value={profile.name}
            onChange={(v) => setProfile((p) => ({ ...p, name: v }))}
          />
          <Field
            icon={Mail}
            label="Correo electrónico"
            value={profile.email}
            onChange={(v) => setProfile((p) => ({ ...p, email: v }))}
          />
          <Field
            icon={Phone}
            label="Teléfono"
            value={profile.phone}
            onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
          />
          <Field
            icon={MapPin}
            label="Ubicación"
            value={profile.location}
            onChange={(v) => setProfile((p) => ({ ...p, location: v }))}
          />
        </div>
      </div>
    </div>
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
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-lv-lg border border-border bg-surface px-3 py-2.5 focus-within:border-accent transition-colors">
        <Icon size={16} strokeWidth={1.5} className="text-muted shrink-0" />
        <input
          className="flex-1 bg-transparent text-small text-foreground outline-none placeholder:text-muted"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

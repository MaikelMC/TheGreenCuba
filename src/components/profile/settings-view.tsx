"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Facebook,
  FileText,
  Instagram,
  Mail,
  MessageCircle,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { siteConfig } from "@/config/site";
import { clearActivity } from "@/lib/activity-store";
import { clearUserPreferences } from "@/lib/user-preferences-store";
import { logout } from "@/lib/logout";

/** La misma dirección que ya usa el panel de negocio. */
const SUPPORT_EMAIL = "soporte@laverde.cu";

const ROLE_NAMES: Record<string, string> = {
  user: "Usuario",
  owner: "Negocio",
  admin: "Administrador",
};

/* Los tres accesos de fuera. Instagram y Facebook son iconos de Lucide;
   WhatsApp no lo es —Lucide no reparte marcas— así que va un bocadillo
   genérico con su nombre accesible, que informa igual sin inventarse un trazo
   que no es el suyo. */
const SOCIALS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Instagram", href: siteConfig.links.instagram, icon: Instagram },
  { label: "Facebook", href: siteConfig.links.facebook, icon: Facebook },
  { label: "WhatsApp", href: siteConfig.links.whatsapp, icon: MessageCircle },
];

interface SessionUser {
  id?: string;
  email: string;
  name: string;
  role: string;
}

export function SettingsView() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: { authenticated: boolean; user: SessionUser | null }) => {
        if (alive && data.authenticated && data.user) setUser({ ...data.user, id: (data.user as unknown as { id?: string }).id ?? "" });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* Borrar la cuenta no puede borrar una cuenta: las demo salen de `.env` y no
     hay base de datos. Lo que sí puede —y lo dice el aviso antes de hacerlo— es
     vaciar lo que este navegador guarda de ti y cerrar la sesión. */
  function handleDelete() {
    clearActivity(user?.id ?? null);
    clearUserPreferences(user?.id ?? null);
    void logout();
  }

  return (
    <div className="flex flex-col gap-gap-xl">
      <header className="flex flex-col gap-gap-xs">
        <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
          Tu cuenta
        </span>
        <h1 className="font-lv-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Configuración
        </h1>
      </header>

      <section className="flex flex-col gap-gap-md rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
        <h2 className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
          Cuenta
        </h2>
        <div className="flex items-center gap-gap-sm">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-verde-200 bg-verde-50 font-lv-display text-body font-bold text-verde-600">
            {(user?.name ?? "·").charAt(0)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-small font-medium text-ink">
              {user?.name ?? "Sin sesión"}
            </span>
            <span className="block truncate text-meta text-ink-soft/75">
              {user?.email ?? "—"}
            </span>
          </span>
          {user && (
            <span className="shrink-0 rounded-full border border-verde-200 bg-verde-50 px-[10px] py-[3px] font-lv-display text-meta font-semibold text-verde-600">
              {ROLE_NAMES[user.role] ?? user.role}
            </span>
          )}
        </div>
      </section>

      <section className="flex flex-col rounded-2xl border border-ink/5 bg-white px-gap-md shadow-soft">
        <h2 className="pt-gap-md font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
          Legal y soporte
        </h2>
        <div className="pb-gap-xs">
          <Row
            icon={FileText}
            label="Términos y condiciones"
            detail="Cómo funciona La Verde y qué se espera de ti"
            href="/terminos"
          />
          <Row
            icon={ShieldCheck}
            label="Privacidad"
            detail="Qué se guarda y dónde se guarda"
            href="/terminos#privacidad"
          />
          <Row
            icon={Mail}
            label="Contacto de soporte"
            detail={SUPPORT_EMAIL}
            href={`mailto:${SUPPORT_EMAIL}`}
          />
        </div>
      </section>

      <section className="flex flex-col gap-gap-sm rounded-2xl border border-destructive/20 bg-destructive/5 p-gap-md">
        <h2 className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-destructive">
          Zona de riesgo
        </h2>
        <p className="text-meta text-pretty text-ink-soft/75">
          Borrar tu cuenta vacía tus preferencias y tu actividad de este navegador
          y cierra la sesión. No se puede deshacer.
        </p>

        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="mt-gap-xs inline-flex h-11 cursor-pointer items-center justify-center gap-gap-xs self-start rounded-full border border-destructive/30 px-gap-lg font-lv-display text-small font-semibold text-destructive transition-colors duration-500 ease-outquint hover:bg-destructive/10"
            >
              <Trash2 size={16} strokeWidth={1.8} />
              Borrar mi cuenta
            </button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Borrar tu cuenta?</DialogTitle>
              <DialogDescription>
                Se borrarán tus preferencias y el historial de lugares de este
                navegador, y se cerrará la sesión. Las cuentas de esta demo no
                viven en un servidor, así que no hay nada más que borrar — pero
                lo que hay aquí se va para siempre.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <button
                  type="button"
                  className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50"
                >
                  Cancelar
                </button>
              </DialogClose>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-gap-xs rounded-full bg-destructive px-gap-lg font-lv-display text-small font-semibold text-white transition-colors duration-500 ease-outquint hover:brightness-110"
              >
                <Trash2 size={16} strokeWidth={1.8} />
                Borrar definitivamente
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section className="flex flex-col items-center gap-gap-sm pt-gap-xs">
        <h2 className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-soft/75">
          Síguenos
        </h2>
        <ul className="flex items-center gap-gap-sm">
          {SOCIALS.map(({ label, href, icon: Icon }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label} de La Verde`}
                className="grid size-12 place-items-center rounded-2xl border border-ink/10 bg-white text-ink-soft/75 shadow-soft transition-all duration-500 ease-outquint hover:-translate-y-0.5 hover:border-verde-300 hover:text-verde-600 active:scale-95"
              >
                <Icon size={20} strokeWidth={1.8} />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Fila de la lista: enlace interno, externo o correo, todos con la misma pinta. */
function Row({
  icon: Icon,
  label,
  detail,
  href,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  href: string;
}) {
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sand text-ink-soft/75">
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-small font-medium text-ink">{label}</span>
        <span className="block truncate text-meta text-ink-soft/75">{detail}</span>
      </span>
      <ChevronRight size={16} strokeWidth={1.8} className="shrink-0 text-ink-soft/75" />
    </>
  );

  const className =
    "flex items-center gap-gap-sm border-b border-ink/5 py-gap-sm transition-colors duration-500 ease-outquint last:border-b-0 hover:text-verde-600";

  // El resto son rutas del sitio y se navegan dentro de la app.
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  // `mailto:` no lleva `target="_blank"`: al no ser una página, algunos
  // navegadores abren una pestaña en blanco además de llamar al gestor de
  // correo. El correo no es una pestaña.
  const externo = href.startsWith("http");
  return (
    <a
      href={href}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={className}
    >
      {content}
    </a>
  );
}

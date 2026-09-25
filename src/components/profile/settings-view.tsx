"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ChevronRight,
  Facebook,
  FileText,
  Instagram,
  Loader2,
  Mail,
  MessageCircle,
  MoonStar,
  ShieldCheck,
  SunMedium,
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
import { toast } from "sonner";
import { siteConfig } from "@/config/site";
import { clearActivity } from "@/lib/activity-store";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { clearUserPreferences, readUserPreferences } from "@/lib/user-preferences-store";
import { logout } from "@/lib/logout";

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
  imageUrl?: string | null;
  role: string;
  /** La versión de los términos que aceptó. `null` en cuentas anteriores a la
      casilla del alta. */
  termsVersion?: string | null;
}

export function SettingsView() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  /* Sin esto, un doble clic manda dos borrados: el segundo llega cuando la fila
     ya no está, el servidor responde 401 y el aviso que sale es el de «no
     pudimos confirmar el borrado» — alarmante y falso. */
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: { authenticated: boolean; user: SessionUser | null }) => {
        if (alive && data.authenticated && data.user) {
          const nextUser = { ...data.user, id: (data.user as unknown as { id?: string }).id ?? "" };
          setUser(nextUser);
          const prefs = readUserPreferences(nextUser.id ?? null);
          if (prefs.avatarUrl) setLocalAvatarUrl(prefs.avatarUrl);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const avatarUrl = user?.imageUrl || localAvatarUrl || null;

  /**
   * Borrar la cuenta.
   *
   * Aquí vivía un comentario que decía que esto no podía borrar una cuenta
   * porque las demo salían de `.env` y no había base de datos. Era verdad
   * entonces y dejó de serlo: hoy hay una fila en `users` con correo, teléfono,
   * ciudad, preferencias, búsquedas y reseñas. Lo que hacía esta función era
   * vaciar el `localStorage` y cerrar sesión, y el diálogo lo contaba —decía que
   * no había nada más que borrar— así que al menos no engañaba. Pero unos
   * términos con derecho de supresión no pueden convivir con un botón que solo
   * limpia el navegador.
   *
   * El `DELETE /api/me` borra la fila y con ella, en cascada, todo lo que cuelga
   * del usuario; después se lleva la cuenta de Neon. El servidor avisa si esa
   * segunda parte no salió.
   */
  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);

    let warning: string | null = null;

    try {
      const response = await fetch("/api/me", { method: "DELETE" });
      const data = (await response.json()) as { accountDeleted?: boolean };
      /* Los datos ya no están —eso lo garantiza el orden de dentro del
         servidor—, pero la credencial sí. Se dice, porque callarlo dejaría a
         alguien creyendo que su correo quedó libre cuando no. */
      if (data.accountDeleted === false) {
        warning = `Tus datos se borraron, pero la cuenta de correo no. Escribe a ${SUPPORT_EMAIL} y la quitamos.`;
      }
    } catch {
      /* Sin respuesta no se sabe si llegó a borrarse. Decir «no se pudo» sería
         afirmar algo que no consta, así que se dice lo que sí se sabe. */
      warning = `No pudimos confirmar el borrado con el servidor. Si al volver a entrar tu cuenta sigue ahí, escribe a ${SUPPORT_EMAIL}.`;
    }

    clearActivity(user?.id ?? null);
    clearUserPreferences(user?.id ?? null);

    /* Con aviso se espera antes de salir: `logout` hace una carga limpia del
       documento y se llevaría por delante el aviso sin que nadie lo lea. */
    if (warning) {
      toast.error(warning, { duration: 9000 });
      window.setTimeout(() => void logout(), 9000);
      return;
    }

    void logout();
  }

  return (
    <div className="flex flex-col gap-gap-xl">
      {/* Sin cabecera propia: el título de la sección ya lo dice la barra
          superior del perfil, y repetirlo aquí era decir lo mismo dos veces. */}
      <section className="flex flex-col gap-gap-md rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
        <h2 className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
          Cuenta
        </h2>
        <div className="flex items-center gap-gap-sm">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Foto de perfil" className="size-11 shrink-0 rounded-full border-2 border-verde-200 object-cover" />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-verde-200 bg-verde-50 font-lv-display text-body font-bold text-verde-600">
              {(user?.name ?? "·").charAt(0)}
            </span>
          )}
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

      <section className="flex flex-col gap-gap-md rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
        <div className="flex items-center justify-between gap-gap-sm">
          <div>
            <h2 className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
              Apariencia
            </h2>
            <p className="mt-1 text-meta text-ink-soft/75">Cambia el tema visual de la app.</p>
          </div>
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="inline-flex items-center gap-gap-xs rounded-full border border-ink/10 bg-sand px-gap-sm py-[8px] font-lv-display text-meta font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700"
            aria-label="Cambiar entre modo claro y oscuro"
          >
            {mounted && resolvedTheme === "dark" ? (
              <>
                <SunMedium size={15} strokeWidth={1.8} />
                Claro
              </>
            ) : (
              <>
                <MoonStar size={15} strokeWidth={1.8} />
                Oscuro
              </>
            )}
          </button>
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
            /* La constancia, a la vista. Guardar en la base qué versión se
               aceptó y no enseñarla en ninguna parte sería un dato que solo nos
               sirve a nosotros, y esto va de lo contrario.

               Sin fecha: `termsAcceptedAt` no sale por `/api/me` y traerlo hasta
               aquí sería otra vuelta por la API para un adorno. La versión basta
               para saber si está al día. */
            detail={
              user?.termsVersion
                ? `Versión aceptada: ${user.termsVersion}`
                : "Cómo funciona La Verde y qué se espera de ti"
            }
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
          Borrar tu cuenta elimina tu ficha y todo lo que cuelga de ella —lugares
          guardados, reseñas, historial de búsquedas, los negocios que lleves— más
          lo que este navegador guarda de ti. No se puede deshacer.
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
                Se borra tu cuenta entera: tu ficha, tus lugares guardados, tus
                reseñas, tu historial de búsquedas y los negocios que lleves,
                además de lo que este navegador guarda de ti. No hay vuelta atrás
                y no guardamos copia.
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
                disabled={deleting}
                aria-busy={deleting}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-gap-xs rounded-full bg-destructive px-gap-lg font-lv-display text-small font-semibold text-white transition-colors duration-500 ease-outquint hover:brightness-110 disabled:pointer-events-none disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <Trash2 size={16} strokeWidth={1.8} />
                )}
                {deleting ? "Borrando..." : "Borrar definitivamente"}
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

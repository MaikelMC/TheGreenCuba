"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Save } from "lucide-react";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/layout/user-menu";
import { BusinessView } from "@/components/profile/business-view";
import { DetailsView } from "@/components/profile/details-view";
import { PlacesView } from "@/components/profile/places-view";
import { SettingsView } from "@/components/profile/settings-view";
import {
  DOCK_ITEMS,
  ProfileDock,
  type ProfileView,
} from "@/components/profile/profile-dock";
import {
  locationLabel,
  readUserPreferences,
  mergeRemoteUserPreferences,
  writeUserPreferences,
  type UserPreferences,
} from "@/lib/user-preferences-store";

/* El halo del botón primario del sistema, para el guardado de la cabecera. */
const SAVE_BTN =
  "bg-verde-400 text-verde-950 shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] hover:bg-verde-300 transition-all duration-500 ease-outquint font-lv-display font-semibold cursor-pointer";

/**
 * Armazón del perfil. Las tres secciones se cambian con el dock, sin tocar la
 * URL —el mismo criterio que sigue el panel de negocio—, así que el formulario
 * conserva lo escrito sin guardar al irse a mirar «Mis lugares» y volver.
 *
 * El estado de las preferencias vive aquí y no en la vista del formulario
 * porque el botón de guardar está en la cabecera, que es del armazón. Por eso
 * ese botón solo se pinta en la vista «Perfil»: en las otras dos no habría nada
 * que guardar y estaría mintiendo.
 */
export default function ProfilePage() {
  const [view, setView] = useState<ProfileView>("perfil");
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  /* La sección se puede pedir desde la URL, y hace falta que se pueda: «Para tu
     negocio» del menú lleva aquí, y el armazón no cambia de ruta —las cuatro
     secciones son la misma página—, así que sin esto el enlace dejaría a quien
     llega en «Perfil» buscando la pestaña a mano.

     Se lee de `window.location` y no con `useSearchParams`, que obligaría a
     envolver la página en un `Suspense` y a renunciar al HTML estático que hoy
     se sirve. Para leer un parámetro una vez al montar, no compensa. */
  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get("seccion");
    if (section && DOCK_ITEMS.some((item) => item.id === section)) {
      setView(section as ProfileView);
    }
  }, []);

  /* Cambiar de sección no navega, pero sí actualiza la URL: así una sección se
     puede compartir y el botón «atrás» no devuelve a un sitio distinto del que
     se está viendo. `replaceState` y no `pushState` a propósito — pasar por tres
     pestañas no debería dejar tres pasos en el historial. */
  function changeView(next: ProfileView) {
    setView(next);

    const url = new URL(window.location.href);
    if (next === "perfil") url.searchParams.delete("seccion");
    else url.searchParams.set("seccion", next);
    window.history.replaceState(null, "", url);
  }

  useEffect(() => {
    const localPrefs = readUserPreferences(userId);
    setPrefs(localPrefs);

    fetch("/api/me")
      .then((res) => res.json())
      .then((data: {
        authenticated: boolean;
        user: {
          id?: string;
          name: string;
          email: string;
          imageUrl?: string | null;
          phone?: string | null;
          locationCity?: string | null;
          onboardingCompleted?: boolean;
          preferences?: { interests?: string[]; moods?: string[]; currencies?: string[] } | null;
        } | null;
      }) => {
        const user = data.user;
        if (!data.authenticated || !user) return;

        const nextUserId = user.id ?? null;
        setUserId(nextUserId);
        const nextLocalPrefs = mergeRemoteUserPreferences(readUserPreferences(nextUserId), user);

        const nextName = user.name || nextLocalPrefs.name;
        const nextEmail = user.email || nextLocalPrefs.email;
        const nextAvatar = user.imageUrl || nextLocalPrefs.avatarUrl;
        /* El teléfono llega de la cuenta desde que tiene columna. El local
           queda de red para quien lo escribió antes de que existiera: se enseña
           y se guarda en el primer «Guardar cambios». */
        const nextPhone = user.phone || nextLocalPrefs.phone;

        setPrefs((current) => {
          const merged = {
            ...(current ?? nextLocalPrefs),
            ...nextLocalPrefs,
            name: nextName,
            email: nextEmail,
            avatarUrl: nextAvatar,
            phone: nextPhone,
          };
          writeUserPreferences(merged, nextUserId);
          return merged;
        });
      })
      .catch(() => {
        // Si no hay sesión o falla la red, se queda con las preferencias locales.
      });
  }, []);

  const title = DOCK_ITEMS.find((item) => item.id === view)?.label ?? "Perfil";

  if (!prefs) {
    return (
      <div className="min-h-dvh bg-sand font-lv text-ink">
        <TopBar title={title} />
        <p className="pt-gap-xl text-center text-small text-ink-soft/75" aria-busy>
          Cargando perfil…
        </p>
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

  async function handleSave() {
    if (!prefs) return;

    writeUserPreferences({
      ...prefs,
      onboardingCompleted: true,
      locationName: locationLabel(prefs.location),
    }, userId);

    try {
      const response = await fetch("/api/me", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...prefs,
          onboardingCompleted: true,
          location: prefs.location,
          locationName: locationLabel(prefs.location),
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          authenticated: boolean;
          user: { name?: string; email?: string; imageUrl?: string | null } | null;
        };

        const savedUser = data.user;
        if (data.authenticated && savedUser) {
          setPrefs((current) => ({
            ...(current ?? prefs),
            name: savedUser.name || current?.name || prefs.name,
            email: savedUser.email || current?.email || prefs.email,
            avatarUrl: savedUser.imageUrl || current?.avatarUrl || prefs.avatarUrl,
          }));
        }
      }
    } catch {
      // Si falla la escritura en DB, al menos se conserva la copia local del navegador.
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-dvh bg-sand font-lv text-ink">
      <TopBar title={title} initial={prefs.name.charAt(0)} avatarUrl={prefs.avatarUrl}>
        {view === "perfil" && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            className={cn(SAVE_BTN, "flex h-9 shrink-0 items-center gap-gap-xs rounded-full px-gap-md text-small")}
          >
            <motion.span
              key={saved ? "saved" : "save"}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="inline-flex items-center gap-[6px]"
            >
              <Save size={15} strokeWidth={1.8} />
              {saved ? "Guardado" : "Guardar"}
            </motion.span>
          </motion.button>
        )}
      </TopBar>

      <div className="mx-auto max-w-lg px-gap-sm pt-gap-lg pb-dock-clear sm:px-gap-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {view === "perfil" && (
              <DetailsView
                prefs={prefs}
                set={set}
                toggle={toggle}
                onSave={handleSave}
                saved={saved}
              />
            )}
            {view === "lugares" && <PlacesView />}
            {view === "negocio" && <BusinessView />}
            {view === "ajustes" && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </div>

      <ProfileDock view={view} onChange={changeView} />
    </div>
  );
}

/* Barra superior del perfil. Misma geometría que la del panel de negocios:
   barra clara translúcida con hairline de tinta y alto `h-header`. El título
   dice la sección activa, no «Perfil» fijo: con tres secciones, una barra que
   siempre diga lo mismo deja de orientar. */
function TopBar({
  title,
  initial,
  avatarUrl,
  children,
}: {
  title: string;
  initial?: string;
  avatarUrl?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-50 flex h-header items-center gap-2 border-b border-ink/5 bg-sand-warm/90 px-3 backdrop-blur-[16px] sm:gap-gap-sm sm:px-gap-md">
      <Link
        href="/home"
        className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft/75 transition-colors duration-500 ease-outquint hover:bg-verde-50 hover:text-verde-600"
        aria-label="Volver al inicio"
      >
        <ArrowLeft size={18} strokeWidth={1.8} />
      </Link>
      <h1 className="truncate font-lv-display text-[18px] font-bold tracking-[-0.02em] text-ink">
        {title}
      </h1>
      <div className="min-w-0 flex-1" />
      {children}
      <UserMenu initial={initial} avatarUrl={avatarUrl} />
    </header>
  );
}

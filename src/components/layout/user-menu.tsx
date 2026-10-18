"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { User, Building2, ShieldCheck, LogOut, Link2, Megaphone, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/session";
import { logout } from "@/lib/logout";
import { readUserPreferences } from "@/lib/user-preferences-store";
import { fetchMe } from "@/lib/session-client";
import { LoginButton } from "@/components/landing/login-button";

/* Hairline entre filas en vez de `<div>` separadores sueltos: es el mismo
   idioma que las filas de la pantalla de preferencias. */
const ITEM =
  "w-full flex items-center gap-gap-sm px-gap-md py-[10px] text-small text-ink border-b border-ink/5 last:border-none hover:bg-verde-50 transition-colors duration-500 text-left";

/**
 * Lo que devuelve `/api/me`: el usuario **de la app**, no el de Neon. El rol no
 * viaja en la sesión de Neon —vive en la tabla `users`— y es lo que decide qué
 * enlaces se enseñan.
 *
 * Aquí hubo un `business: string | null` que se va con la autenticación propia.
 * Existía porque la sesión de demo lo traía del listado de cuentas, pero no lo
 * pintaba nadie: el menú enseña nombre, correo y rol. Mantenerlo obligaría
 * ahora a una consulta a `business_owners` para llenar un campo que no se lee.
 */
interface SessionUser {
  id?: string;
  email: string;
  name: string;
  imageUrl?: string | null;
  role: Role;
  /** El negocio que lleva, si lleva alguno. Solo se lee para decidir si el
      enlace al panel ya tiene destino: mientras esté pendiente de aprobación,
      `/business` devuelve al perfil y ofrecerlo sería un enlace que rebota. */
  business?: { isActive: boolean } | null;
  /** Si el administrador le activó el programa de afiliados. Con esto en falso
      —o ausente, que es lo mismo cuando la respuesta es de antes— «Enlaces» no
      se ofrece: la página rebotaría, porque no tendría código que enseñar. */
  affiliateEnabled?: boolean;
  /** Si ya tiene algún proyecto. Sin ninguno, «Administrar proyectos» no se
      ofrece: el panel solo enseñaría el estado vacío que manda a «Tengo un
      negocio» del perfil, y ese camino ya está en el perfil. */
  hasProjects?: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  user: "Usuario",
  owner: "Negocio",
  admin: "Administrador",
};

/**
 * La última respuesta buena de `/api/me`, guardada en el módulo.
 *
 * El menú solo pregunta una vez, al montarse, y el Header se vuelve a montar
 * cada vez que se llega a una pantalla que lo enseña desde otra que no lo
 * enseña —`/profile`, `/notifications` y `/business` tienen cabecera propia—.
 * Con una red que falla a ratos, esa única pregunta se pierde y el menú se
 * quedaba en su forma de «sin sesión»: ni nombre, ni enlaces, y un «Cerrar
 * sesión» suelto, hasta recargar a mano. Con esto, la vuelta al home pinta al
 * instante lo último que sí se supo mientras la petición nueva viaja.
 *
 * Vive solo en memoria: se pierde al recargar, y `logout()` sale con
 * `window.location.assign`, así que nunca sobrevive a un cierre de sesión.
 */
let lastKnownUser: SessionUser | null = null;

/** Marca de «este dispositivo ya vio el aviso del menú». Una vez, no por sesión. */
const HINT_KEY = "la-verde:user-menu-hint";

/**
 * Cada entrada declara qué roles la pueden abrir. Es la misma tabla que aplica
 * el middleware en `src/lib/session.ts`, repetida aquí para no ofrecer un enlace
 * que va a rebotar. Un usuario normal no tiene por qué ver "Panel de
 * administración" y descubrir al pulsarlo que no puede.
 */
const ITEMS: {
  path: string;
  label: string;
  icon: typeof User;
  roles: Role[];
}[] = [
  {
    path: "/profile",
    label: "Perfil de usuario",
    icon: User,
    roles: ["user", "owner", "admin"],
  },
  /* Aquí estaba «Notificaciones». Se fue con la campana del mapa: la lista es
     la misma y tenerla en dos sitios era el mismo aviso contado dos veces. La
     puerta es la burbuja del home —`MapNotifications`—, que además es donde
     caen las campañas, y su «Ver todas» sigue llevando a `/notifications`. */
  {
    path: "/business",
    label: "Panel de negocio",
    icon: Building2,
    roles: ["owner", "admin"],
  },
  {
    path: "/projects",
    label: "Administrar proyectos",
    icon: Megaphone,
    roles: ["user", "owner", "admin"],
  },
  {
    path: "/enlaces",
    label: "Enlaces",
    icon: Link2,
    roles: ["user", "owner", "admin"],
  },
  {
    path: "/admin",
    label: "Panel de administración",
    icon: ShieldCheck,
    roles: ["admin"],
  },
];

export function UserMenu({
  initial,
  avatarUrl,
}: {
  initial?: string;
  avatarUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(lastKnownUser);
  /* Tres estados, no dos: «todavía no se sabe» no es «no hay sesión». Con dos,
     la esquina no se podía pintar hasta terminar de preguntar sin arriesgarse a
     enseñar el botón de entrar a quien sí tiene sesión. */
  const [status, setStatus] = useState<"unknown" | "in" | "out">(
    lastKnownUser ? "in" : "unknown",
  );
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const prefs = readUserPreferences(user?.id ?? null);
      if (prefs.avatarUrl) setLocalAvatarUrl(prefs.avatarUrl);
    } catch {
      // Sin preferencias válidas, deja el avatar por defecto.
    }
  }, [user?.id]);

  /* El aviso de primera visita: quien acaba de entrar no sabe que ese botón
     esconde las secciones, así que se le señala una vez y no se le vuelve a
     molestar. Se marca como visto al enseñarlo, no al cerrarlo — si el
     navegador se cierra a mitad, ya cumplió su función.

     Solo sale con sesión resuelta: quien no ha entrado no tiene secciones que
     descubrir, y ahí el botón es el de «Entrar». Con `localStorage` bloqueado
     se calla en vez de repetir el aviso en cada carga. */
  useEffect(() => {
    if (status !== "in" || !user) return;
    try {
      if (window.localStorage.getItem(HINT_KEY)) return;
    } catch {
      return;
    }

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const showTimer = setTimeout(() => {
      setHintOpen(true);
      try {
        window.localStorage.setItem(HINT_KEY, "1");
      } catch {
        // Sin almacenamiento no se puede deduplicar; ya se enseñó esta vez.
      }
      hideTimer = setTimeout(() => setHintOpen(false), 9000);
    }, 1200);

    return () => {
      clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [status, user]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    /* `/api/me` y no `authClient.useSession()`: el cliente de Neon sabe el
       correo, pero no el rol, que es la mitad de lo que este menú necesita. */
    async function load(attempt: number): Promise<void> {
      const data = await fetchMe<{
        authenticated: boolean;
        user: SessionUser | null;
      }>({ force: attempt > 0 }).catch(() => null);

      if (!alive) return;

      if (data?.authenticated) {
        lastKnownUser = data.user;
        setUser(data.user);
        setStatus("in");
        if (data.user?.id) {
          const prefs = readUserPreferences(data.user.id);
          if (prefs.avatarUrl) setLocalAvatarUrl(prefs.avatarUrl);
        }
        return;
      }

      /* La ruta contestó «no hay sesión»: el botón de entrar sale ya, sin
         esperar al reintento. No se pierde nada por enseñarlo antes de tiempo,
         porque si el reintento dice que sí —el viaje a Neon se cayó una vez— el
         botón se cambia por el avatar. */
      if (data) setStatus("out");

      /* Un segundo intento, y solo uno. La ruta resuelve la sesión contra Neon
         y, cuando esa ida falla, contesta `authenticated: false` —igual que si
         de verdad no hubiera sesión—, así que sin esto el menú se quedaba en su
         forma de «sin sesión» hasta recargar a mano. La espera es corta porque
         lo que se reintenta es un fallo de red, no una cola. */
      if (attempt === 0) {
        timer = setTimeout(() => void load(1), 1500);
        return;
      }

      /* Dos respuestas sin sesión, o dos fallos de red. En los dos casos se
         acaba aquí: ofrecer entrar es mejor que dejar la esquina muerta. Antes
         no se pintaba nada, y quien volvía de la pantalla de inactividad se
         encontraba en el home sin menú, sin perfil y sin más salida que
         adivinar que `/login` existe. */
      setStatus("out");
    }

    void load(0);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setHintOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  const handleLogout = useCallback(() => {
    setOpen(false);
    void logout();
  }, []);

  // El nombre de la sesión manda sobre el `initial` que pase quien lo use: el
  // primero viene del servidor con la firma comprobada, el segundo es una
  // cadena escrita a mano en la llamada.
  const resolvedAvatarUrl =
    avatarUrl || user?.imageUrl || localAvatarUrl || null;
  const avatar = user?.name?.trim().charAt(0).toUpperCase() || initial;
  /* Sin `user` no se ofrece **ninguna** entrada, y antes se ofrecían todas.
     `/api/me` es un viaje de red: hasta que contesta no se sabe el rol, así que
     el fallback `: ITEMS` enseñaba «Panel de administración» a todo el mundo
     durante ese hueco —el parpadeo que se veía al abrir el menú nada más
     cargar— y se lo dejaba puesto a quien no tiene sesión, que además se
     comía un enlace que rebota. Ausencia de dato no es «puede todo»: es que
     todavía no se sabe. */
  const visible = user
    ? ITEMS.filter(
        (i) =>
          i.roles.includes(user.role) &&
          /* El panel de negocio no existe hasta que lo aprueban. El rol se
             concede al enviar la solicitud, así que por sí solo no basta: el
             negocio tiene que estar publicado. */
          (i.path !== "/business" || Boolean(user.business?.isActive)) &&
          /* Y «Enlaces» no existe hasta que un administrador lo active. Ningún
             rol lo implica: es un permiso suelto, y sin él la página rebotaría
             al perfil. */
          (i.path !== "/enlaces" || Boolean(user.affiliateEnabled)) &&
          /* «Administrar proyectos» solo aparece con el primero ya creado. El
             rol no lo implica —cualquier usuario puede tener proyectos— y el
             alta se hace desde «Tengo un negocio», en el perfil. */
          (i.path !== "/projects" || Boolean(user.hasProjects)),
      )
    : [];

  /* Sin sesión, un botón para entrar; sin saberlo todavía, nada.

     El menú no se pinta sin usuario porque dentro solo estaría «Cerrar sesión»,
     que para quien no ha entrado no es una opción sino una mentira. Pero la
     esquina tampoco puede quedarse vacía: es el sitio al que mira quien quiere
     volver a entrar, y ahí no había nada. Lo que se pinta en ese hueco es el
     mismo botón de la portada, que ya lleva a `/login`.

     `initial` y `avatarUrl` cuentan como saberlo: solo los pasa una pantalla
     cerrada (`/profile`), que ya tiene la sesión resuelta por el proxy. */
  if (!user && !initial && !avatarUrl) {
    if (status !== "out") return null;
    return (
      <LoginButton className="shrink-0 px-3 py-2 text-[13px] sm:px-[18px] sm:py-2.5 sm:text-sm" />
    );
  }

  return (
    <div
      ref={ref}
      className="relative shrink-0"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      {/* Verde casi tinta, como la pastilla de la cabecera de la landing: sobre
          la barra clara del header es lo único que se lee de un vistazo. El
          `verde-50` anterior se perdía contra el `sand-warm`.

          El chevron es la señal universal de «aquí se despliega algo». Antes era
          un círculo con la inicial a secas y se leía como la foto de perfil, no
          como la puerta a las secciones: nadie lo tocaba. La pastilla sigue
          midiendo 44 px de alto, así que el objetivo táctil no cambia. */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={() => {
          setOpen((v) => !v);
          setHintOpen(false);
        }}
        aria-label="Abrir menú de cuenta y secciones"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        className="group flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-verde-950 py-1 pl-1 pr-[10px] text-white transition-colors duration-500 hover:bg-verde-800"
      >
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-verde-800 font-lv-display text-small font-bold">
          {resolvedAvatarUrl ? (
            <img
              src={resolvedAvatarUrl}
              alt="Foto de perfil"
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          ) : (
            (avatar ?? <User size={18} strokeWidth={1.8} />)
          )}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={cn(
            "shrink-0 transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </motion.button>

      {/* Aviso de primera visita: un halo que late sobre el botón y una frase
          que dice qué hay dentro. `pointer-events-none` en los dos para que
          nunca atrapen un toque que iba a otra parte; se apaga solo a los 9 s,
          al abrir el menú o al tocar fuera. */}
      {hintOpen && (
        <motion.span
          aria-hidden
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.5, 0], scale: [1, 1.18, 1.18] }}
          transition={{ duration: 1.9, repeat: Infinity, repeatDelay: 0.3 }}
          className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-verde-400"
        />
      )}
      <AnimatePresence>
        {hintOpen && (
          <motion.div
            key="hint"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute right-0 top-[calc(100%+10px)] z-50 w-[212px] rounded-2xl bg-ink px-3.5 py-2.5 font-lv-display text-[12px] leading-snug text-white shadow-card"
          >
            <span
              aria-hidden
              className="absolute -top-1 right-6 size-2 rotate-45 bg-ink"
            />
            Aquí está todo: tu perfil y las secciones de tu cuenta.
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            id="user-menu"
            className="user-menu-popup absolute right-0 top-[calc(100%+6px)] w-[236px] bg-white border border-ink/5 rounded-2xl shadow-card z-50 overflow-hidden"
          >
            {user && (
              <div className="px-gap-md py-gap-sm border-b border-ink/5 bg-sand">
                <div className="font-lv-display text-small font-semibold text-ink truncate">
                  {user.name}
                </div>
                <div className="text-meta text-ink-soft/75 truncate">
                  {user.email}
                </div>
                <div className="mt-[6px] inline-flex items-center gap-[6px] px-[8px] py-[2px] rounded-full bg-verde-50 border border-verde-200 font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-verde-700">
                  {ROLE_LABEL[user.role]}
                </div>
              </div>
            )}

            {visible.map(({ path, label, icon: Icon }) => (
              <motion.button
                key={path}
                type="button"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => handleSelect(path)}
                className={`${ITEM} ${path === "/business" || path === "/admin" ? "user-menu-panel-item" : ""}`}
              >
                <Icon
                  size={16}
                  strokeWidth={1.8}
                  className={`user-menu-icon ${path === "/business" || path === "/admin" ? "user-menu-panel-icon" : "text-verde-600"} shrink-0`}
                />
                {label}
              </motion.button>
            ))}

            <motion.button
              type="button"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              onClick={handleLogout}
              className={`${ITEM} text-destructive hover:bg-destructive/5`}
            >
              <LogOut size={16} strokeWidth={1.8} className="shrink-0" />
              Cerrar sesión
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

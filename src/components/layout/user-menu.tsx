"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "motion/react";
import {
  User,
  Building2,
  ShieldCheck,
  LogOut,
  Link2,
  Megaphone,
  ChevronDown,
  Heart,
  CreditCard,
  ShoppingBag,
  MoonStar,
  SunMedium,
  LifeBuoy,
  FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/session";
import { logout } from "@/lib/logout";
import { fetchMe, refreshSession } from "@/lib/session-client";
import { LoginButton } from "@/components/landing/login-button";
import { navegar } from "@/lib/navegar";
import { readActivity } from "@/lib/activity-store";

/* Hairline entre filas en vez de `<div>` separadores sueltos: es el mismo
   idioma que las filas de la pantalla de preferencias. */
const ITEM =
  "w-full flex items-center gap-gap-sm px-gap-md py-[10px] text-small text-ink border-b border-ink/5 last:border-none hover:bg-verde-50 transition-colors duration-500 text-left";

/**
 * Lo que devuelve `/api/me`: el usuario **de la app**, no el de Better Auth. El rol no
 * viaja en la sesión de Better Auth —vive en la tabla `users`— y es lo que decide qué
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
  role: Role;
  /** El negocio que lleva, si lleva alguno. `id` y `name` son los que usa el
      punto de pendientes del avatar; `isActive` decide si el panel tiene
      destino. Mientras esté pendiente de aprobación, `/business` devuelve al
      perfil y ofrecerlo sería un enlace que rebota. */
  business?: { id?: string; name?: string; isActive: boolean } | null;
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

/** Cuántas tarjetas de cliente frecuente guardó este dispositivo. */
function contarTarjetas(): number {
  try {
    return Object.keys(window.localStorage).filter((clave) =>
      clave.startsWith("la-verde:tarjeta:"),
    ).length;
  } catch {
    return 0;
  }
}

function pedidosTexto(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? "pedido" : "pedidos"}`;
}

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
    label: "Panel de afiliado",
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

/**
 * Las entradas que puede abrir un usuario. Vive fuera del componente porque la
 * usan el render y el precargado, y las dos tienen que decir lo mismo: si el
 * render ofrece una ruta que el precargado no calentó, vuelve el viaje en frío.
 */
function itemsFor(user: SessionUser) {
  return ITEMS.filter(
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
         alta se hace desde «Info», en el perfil. */
      (i.path !== "/projects" || Boolean(user.hasProjects)),
  );
}

/**
 * Una entrada propia de la pantalla que monta el menú (el panel de negocio:
 * «Ir a La Verde», «Ver mi ficha», el tema…). Con `href` sale un enlace que
 * abre en otra pestaña; sin él, un botón.
 */
export interface EntradaMenu {
  key: string;
  label: string;
  icon: typeof User;
  href?: string;
  onSelect?: () => void;
}

export function UserMenu({
  initial,
  extras = [],
  antesDeSalir,
  compact = false,
}: {
  initial?: string;
  /** Entradas que van antes de las secciones de la cuenta. */
  extras?: EntradaMenu[];
  /**
   * La guardia de trabajo sin guardar de quien monta el menú. Se consulta
   * antes de irse a otra sección de la cuenta y antes de cerrar sesión.
   */
  antesDeSalir?: () => boolean;
  /**
   * Avatar circular sin flecha para la barra del home. El punto ámbar sale
   * cuando el panel del usuario tiene algo pendiente: pedidos si es negocio,
   * la bandeja si es administrador. En el resto de cabeceras se mantiene la
   * pastilla con flecha.
   */
  compact?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [temaMontado, setTemaMontado] = useState(false);
  useEffect(() => setTemaMontado(true), []);
  const [open, setOpen] = useState(false);
  const [pendientesPedidos, setPendientesPedidos] = useState<number | null>(
    null,
  );
  const [pendientesAdmin, setPendientesAdmin] = useState<number | null>(null);
  const hayPendientes =
    (pendientesPedidos ?? 0) > 0 || (pendientesAdmin ?? 0) > 0;
  const [user, setUser] = useState<SessionUser | null>(lastKnownUser);
  /* Tres estados, no dos: «todavía no se sabe» no es «no hay sesión». Con dos,
     la esquina no se podía pintar hasta terminar de preguntar sin arriesgarse a
     enseñar el botón de entrar a quien sí tiene sesión. */
  const [status, setStatus] = useState<"unknown" | "in" | "out">(
    lastKnownUser ? "in" : "unknown",
  );
  const [hintOpen, setHintOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

    /* `/api/me` y no `authClient.useSession()`: el cliente de Better Auth sabe el
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
        return;
      }

      /* La ruta contestó «no hay sesión»: el botón de entrar sale ya, sin
         esperar al reintento. No se pierde nada por enseñarlo antes de tiempo,
         porque si el reintento dice que sí —el viaje a la base se cayó una vez— el
         botón se cambia por el avatar.

         Se limpia también el usuario: la sesión puede haber caducado entre dos
         visitas, y dejar `user` puesto mantenía el avatar y un «Cerrar sesión»
         para alguien que ya no tenía sesión. */
      if (data) {
        lastKnownUser = null;
        setUser(null);
        setStatus("out");
      }

      /* Un segundo intento, y solo uno. La ruta resuelve la sesión contra la base
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
         adivinar que `/login` existe.

         Pero si ya se sabía que había sesión, un doble fallo de red no la
         convierte en «no hay sesión»: se conserva el avatar y se reintenta en
         la próxima vuelta a la pestaña. */
      if (!lastKnownUser) setStatus("out");
    }

    void load(0);

    /* Safari iOS restaura la página desde bfcache con el DOM tal cual se dejó
       y no vuelve a montar el componente. Sin esto, el avatar o el botón de
       entrar se quedaban congelados hasta recargar a mano. */
    function revalidar() {
      if (document.visibilityState !== "visible") return;
      void load(1);
    }
    function alRestaurar(evento: PageTransitionEvent) {
      if (!evento.persisted) return;
      refreshSession();
      void load(1);
    }
    document.addEventListener("visibilitychange", revalidar);
    window.addEventListener("pageshow", alRestaurar);

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", revalidar);
      window.removeEventListener("pageshow", alRestaurar);
    };
  }, []);

  /* Los pendientes del menú y del punto del avatar. Se piden una sola vez por
     usuario: el contador de pedidos solo se pinta si el endpoint responde, que
     es lo que confirma que el negocio tiene el servicio de pedidos activo. */
  useEffect(() => {
    if (!user) {
      setPendientesPedidos(null);
      setPendientesAdmin(null);
      return;
    }

    setPendientesPedidos(null);
    setPendientesAdmin(null);
    let vivo = true;
    const controller = new AbortController();

    async function cargar() {
      try {
        if (user!.role === "admin") {
          const respuesta = await fetch("/api/admin/contadores", {
            signal: controller.signal,
          });
          if (respuesta.ok) {
            const datos = (await respuesta.json()) as {
              pendientes?: number;
            };
            if (vivo) setPendientesAdmin(datos.pendientes ?? 0);
          }
        }

        if (user!.business?.isActive && user!.business.id) {
          const respuesta = await fetch(
            `/api/pedidos/pendientes?placeId=${encodeURIComponent(user!.business.id)}`,
            { signal: controller.signal },
          );
          if (respuesta.ok) {
            const datos = (await respuesta.json()) as { pendientes?: number };
            if (vivo) setPendientesPedidos(datos.pendientes ?? 0);
          }
        }
      } catch {
        /* Sin red o sin permiso: no se pinta un pendiente inventado. */
      }
    }

    void cargar();
    return () => {
      vivo = false;
      controller.abort();
    };
  }, [user]);

  useEffect(() => {
    function handleClick(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setHintOpen(false);
      }
    }
    /* `pointerdown` y no `mousedown`: en iOS Safari un toque fuera del menú
       sobre un elemento no interactivo no siempre dispara `mousedown`, y el
       desplegable se quedaba abierto. */
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, []);

  /* Las secciones no están en pantalla como `<Link>`: viven dentro de este
     menú y se abren con `router.push`. Next solo precarga lo que encuentra
     enlazado, así que la primera entrada a cada una pagaba el viaje entero
     —payload del servidor y trozo de JavaScript— con la pantalla quieta. En
     cuanto se sabe quién es, se calientan las rutas que su menú ofrece. Los
     dos paneles quedan fuera: entran con recarga completa a propósito (ver
     `handleSelect`). */
  useEffect(() => {
    if (!user) return;
    for (const item of itemsFor(user)) {
      if (item.path !== "/business" && item.path !== "/admin") {
        router.prefetch(item.path);
      }
    }
  }, [user, router]);

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false);
      if (antesDeSalir && !antesDeSalir()) return;
      /* Los dos paneles entran con carga completa y no con navegación de cliente.
         Son las dos rutas más pesadas de la app —los armazones de admin y de
         negocio, cada uno con su propio árbol de componentes— y en una
         navegación suave el navegador no recibe HTML de la ruta nueva: tras el
         esqueleto se quedaba la pantalla vacía hasta que llegaban todos los
         trozos de JavaScript. Con una carga completa el servidor manda el panel
         ya pintado y el contenido se ve sin esperar al cliente. El resto de
         secciones, que comparten la app cargada, siguen navegando sin recargar. */
      if (
        path === "/business" ||
        path.startsWith("/business?") ||
        path === "/admin"
      ) {
        window.location.assign(path);
        return;
      }
      navegar(path, router.push);
    },
    [router, antesDeSalir],
  );

  const handleLogout = useCallback(() => {
    if (antesDeSalir && !antesDeSalir()) return;
    if (!window.confirm("¿Cerrar sesión en este dispositivo?")) return;
    setOpen(false);
    /* La copia en memoria no puede sobrevivir al cierre: aunque `logout()`
       recarga la página al final, si la recarga se queda a medias el siguiente
       montaje pintaría el avatar del usuario que acaba de salir. */
    lastKnownUser = null;
    void logout();
  }, [antesDeSalir]);

  // El nombre de la sesión manda sobre el `initial` que pase quien lo use: el
  // primero viene del servidor con la firma comprobada, el segundo es una
  // cadena escrita a mano en la llamada.
  const avatar = user?.name?.trim().charAt(0).toUpperCase() || initial;
  /* Sin `user` no se ofrece **ninguna** entrada, y antes se ofrecían todas.
     `/api/me` es un viaje de red: hasta que contesta no se sabe el rol, así que
     el fallback `: ITEMS` enseñaba «Panel de administración» a todo el mundo
     durante ese hueco —el parpadeo que se veía al abrir el menú nada más
     cargar— y se lo dejaba puesto a quien no tiene sesión, que además se
     comía un enlace que rebota. Ausencia de dato no es «puede todo»: es que
     todavía no se sabe. */
  const guardados = user ? readActivity(user.id).savedIds.length : 0;
  const tarjetas = user ? contarTarjetas() : 0;
  const temaOscuro = temaMontado && resolvedTheme === "dark";

  const loMio = user
    ? [
        {
          key: "perfil",
          label: "Mi perfil",
          sub: null,
          icon: User,
          path: "/profile",
        },
        {
          key: "favoritos",
          label: "Mis favoritos",
          sub: `${guardados} ${guardados === 1 ? "guardado" : "guardados"}`,
          icon: Heart,
          path: "/profile?seccion=lugares",
        },
        {
          key: "tarjetas",
          label: "Mis tarjetas",
          sub: `${tarjetas} ${tarjetas === 1 ? "tarjeta" : "tarjetas"}`,
          icon: CreditCard,
          path: "/tarjetas",
        },
        ...(pendientesPedidos !== null
          ? [
              {
                key: "pedidos",
                label: "Mis pedidos",
                sub: pedidosTexto(pendientesPedidos),
                icon: ShoppingBag,
                path: "/business?seccion=pedidos",
              },
            ]
          : []),
      ]
    : [];

  const paneles = user
    ? [
        ...(user.business?.isActive
          ? [
              {
                key: "negocio",
                label: "Panel de negocio",
                sub: `${user.business.name ?? "Tu negocio"}${
                  pendientesPedidos !== null
                    ? ` · ${pedidosTexto(pendientesPedidos)}`
                    : ""
                }`,
                icon: Building2,
                path: "/business",
                badge: pendientesPedidos ?? 0,
              },
            ]
          : []),
        ...(user.hasProjects
          ? [
              {
                key: "proyectos",
                label: "Administrar proyectos",
                sub: null,
                icon: FolderKanban,
                path: "/projects",
                badge: 0,
              },
            ]
          : []),
        ...(user.affiliateEnabled
          ? [
              {
                key: "afiliado",
                label: "Panel de afiliado",
                sub: "Código y comisiones",
                icon: Link2,
                path: "/enlaces",
                badge: 0,
              },
            ]
          : []),
        ...(user.role === "admin"
          ? [
              {
                key: "admin",
                label: "Panel de administración",
                sub: `${pendientesAdmin ?? 0} pendientes`,
                icon: ShieldCheck,
                path: "/admin",
                badge: pendientesAdmin ?? 0,
              },
            ]
          : []),
      ]
    : [];

  /* Sin sesión, un botón para entrar; sin saberlo todavía, nada.

     El menú no se pinta sin usuario porque dentro solo estaría «Cerrar sesión»,
     que para quien no ha entrado no es una opción sino una mentira. Pero la
     esquina tampoco puede quedarse vacía: es el sitio al que mira quien quiere
     volver a entrar, y ahí no había nada. Lo que se pinta en ese hueco es el
     mismo botón de la portada, que ya lleva a `/login`.

     `initial` cuenta como saberlo: solo lo pasa una pantalla cerrada
     (`/profile`), que ya tiene la sesión resuelta por el proxy. */
  if (!user && !initial) {
    if (status !== "out") {
      /* En la barra del home el hueco del avatar se reserva: si no, el campo
         de búsqueda se estira y se encoge cuando llega `/api/me`. */
      return compact ? (
        <span
          aria-hidden
          className="skeleton-shimmer size-11 shrink-0 rounded-full"
        />
      ) : null;
    }
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
        aria-label={
          hayPendientes
            ? "Abrir menú de cuenta y secciones, hay pendientes"
            : "Abrir menú de cuenta y secciones"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        className={cn(
          "group relative flex shrink-0 cursor-pointer items-center rounded-full bg-verde-950 text-white transition-colors duration-500 hover:bg-verde-800",
          compact
            ? "size-11 justify-center"
            : "gap-1 py-1 pl-1 pr-[10px]",
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-verde-800 font-lv-display text-small font-bold">
          {avatar ?? <User size={18} strokeWidth={1.8} />}
        </span>
        {!compact && (
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden
            className={cn(
              "shrink-0 transition-transform duration-300",
              open && "rotate-180",
            )}
          />
        )}
        {compact && hayPendientes && (
          <span
            aria-hidden
            className="absolute right-0 top-0 size-3 rounded-full border-2 border-sand-warm bg-lv-amber dark:border-ink"
          />
        )}
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
              <div className="border-b border-ink/5 bg-sand px-gap-md py-gap-sm">
                <div className="truncate font-lv-display text-small font-semibold text-ink">
                  {user.name}
                </div>
                <div className="truncate text-meta text-ink-soft/75">
                  {user.email}
                </div>
                {user.role === "admin" && (
                  <div className="mt-[6px] inline-flex items-center gap-[6px] rounded-full border border-verde-200 bg-verde-50 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-verde-700">
                    {ROLE_LABEL[user.role]}
                  </div>
                )}
              </div>
            )}

            {extras.map(({ key, label, icon: Icon, href, onSelect }) =>
              href ? (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className={ITEM}
                >
                  <Icon size={16} strokeWidth={1.8} className="user-menu-icon shrink-0 text-verde-600" />
                  {label}
                </a>
              ) : (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSelect?.();
                  }}
                  className={ITEM}
                >
                  <Icon size={16} strokeWidth={1.8} className="user-menu-icon shrink-0 text-verde-600" />
                  {label}
                </button>
              ),
            )}

            {loMio.length > 0 && (
              <>
                <p className="border-b border-ink/5 px-gap-md pb-[4px] pt-gap-sm font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft/60">
                  Lo mío
                </p>
                {loMio.map(({ key, label, sub, icon: Icon, path }) => (
                  <motion.button
                    key={key}
                    type="button"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => handleSelect(path)}
                    className={ITEM}
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.8}
                      className="user-menu-icon shrink-0 text-verde-600"
                    />
                    <span className="flex min-w-0 flex-1 items-center gap-gap-xs">
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {sub && (
                        <span className="shrink-0 text-meta text-ink-soft/60">
                          {sub}
                        </span>
                      )}
                    </span>
                  </motion.button>
                ))}
              </>
            )}

            {paneles.length > 0 && (
              <>
                <p className="border-b border-ink/5 px-gap-md pb-[4px] pt-gap-sm font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft/60">
                  Tus paneles
                </p>
                {paneles.map(
                  ({ key, label, sub, icon: Icon, path, badge }) => (
                    <motion.button
                      key={key}
                      type="button"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      onClick={() => handleSelect(path)}
                      className={`${ITEM} user-menu-panel-item`}
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.8}
                        className="user-menu-icon user-menu-panel-icon shrink-0"
                      />
                      <span className="flex min-w-0 flex-1 flex-col py-[4px]">
                        <span className="truncate">{label}</span>
                        {sub && (
                          <span className="truncate text-meta text-ink-soft/60">
                            {sub}
                          </span>
                        )}
                      </span>
                      {badge > 0 && (
                        <span className="inline-flex min-w-[22px] shrink-0 items-center justify-center rounded-full bg-lv-amber px-[6px] font-lv-display text-[12px] font-bold leading-[22px] text-verde-950">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </motion.button>
                  ),
                )}
              </>
            )}

            <p className="border-b border-ink/5 px-gap-md pb-[4px] pt-gap-sm font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft/60">
              Preferencias
            </p>
            <button
              type="button"
              onClick={() => setTheme(temaOscuro ? "light" : "dark")}
              className={ITEM}
            >
              {temaOscuro ? (
                <SunMedium
                  size={16}
                  strokeWidth={1.8}
                  className="user-menu-icon shrink-0 text-verde-600"
                />
              ) : (
                <MoonStar
                  size={16}
                  strokeWidth={1.8}
                  className="user-menu-icon shrink-0 text-verde-600"
                />
              )}
              <span className="flex-1">Tema</span>
              <span className="text-meta text-ink-soft/60">
                {temaOscuro ? "Oscuro" : "Claro"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect("/profile?seccion=ajustes")}
              className={ITEM}
            >
              <LifeBuoy
                size={16}
                strokeWidth={1.8}
                className="user-menu-icon shrink-0 text-verde-600"
              />
              Ayuda y soporte
            </button>

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

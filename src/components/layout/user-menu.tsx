"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { User, Building2, ShieldCheck, LogOut } from "lucide-react";
import type { Role } from "@/lib/session";
import { logout } from "@/lib/logout";
import { readUserPreferences } from "@/lib/user-preferences-store";

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
}

const ROLE_LABEL: Record<Role, string> = {
  user: "Usuario",
  owner: "Negocio",
  admin: "Administrador",
};

/**
 * Cada entrada declara qué roles la pueden abrir. Es la misma tabla que aplica
 * el middleware en `src/lib/session.ts`, repetida aquí para no ofrecer un enlace
 * que va a rebotar. Un usuario normal no tiene por qué ver "Panel de
 * administración" y descubrir al pulsarlo que no puede.
 */
const ITEMS: { path: string; label: string; icon: typeof User; roles: Role[] }[] = [
  { path: "/profile", label: "Perfil de usuario", icon: User, roles: ["user", "owner", "admin"] },
  { path: "/business", label: "Panel de negocio", icon: Building2, roles: ["owner", "admin"] },
  { path: "/admin", label: "Panel de administración", icon: ShieldCheck, roles: ["admin"] },
];

export function UserMenu({ initial, avatarUrl }: { initial?: string; avatarUrl?: string }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
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

  useEffect(() => {
    let alive = true;
    /* `/api/me` y no `authClient.useSession()`: el cliente de Neon sabe el
       correo, pero no el rol, que es la mitad de lo que este menú necesita. */
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: { authenticated: boolean; user: SessionUser | null }) => {
        if (alive && data.authenticated) {
          setUser(data.user);
          if (data.user?.id) {
            const prefs = readUserPreferences(data.user.id);
            if (prefs.avatarUrl) setLocalAvatarUrl(prefs.avatarUrl);
          }
        }
      })
      // Sin sesión o sin red, el menú queda con lo que ya tenía: no es un error
      // que merezca un aviso en pantalla.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
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
  const resolvedAvatarUrl = avatarUrl || user?.imageUrl || localAvatarUrl || null;
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
          (i.path !== "/business" || Boolean(user.business?.isActive)),
      )
    : [];

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Verde casi tinta, como la pastilla de la cabecera de la landing: sobre
          la barra clara del header es lo único que se lee de un vistazo. El
          `verde-50` anterior se perdía contra el `sand-warm`. */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        className="size-11 shrink-0 overflow-hidden rounded-full bg-verde-950 grid place-items-center text-white font-lv-display font-bold text-small transition-colors duration-500 hover:bg-verde-800"
        aria-label="Menú de usuario"
      >
        {resolvedAvatarUrl ? (
          <img src={resolvedAvatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
        ) : (
          avatar ?? <User size={18} strokeWidth={1.8} />
        )}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+6px)] w-[236px] bg-white border border-ink/5 rounded-2xl shadow-card z-50 overflow-hidden"
          >
            {user && (
              <div className="px-gap-md py-gap-sm border-b border-ink/5 bg-sand">
                <div className="font-lv-display text-small font-semibold text-ink truncate">
                  {user.name}
                </div>
                <div className="text-meta text-ink-soft/75 truncate">{user.email}</div>
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
                className={ITEM}
              >
                <Icon size={16} strokeWidth={1.8} className="text-verde-600 shrink-0" />
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

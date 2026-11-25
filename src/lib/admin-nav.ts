import {
  Activity,
  BarChart3,
  BadgeDollarSign,
  BellRing,
  Bot,
  ClipboardList,
  HandCoins,
  History,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Send,
  Sparkles,
  Store,
  Tags,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ContadoresAdmin } from "@/lib/admin-contadores";

/**
 * La navegación del panel, agrupada por lo que se hace cada día.
 *
 * Antes era una lista plana ordenada como el mapa del sistema. El orden aquí va
 * de lo urgente a lo que se toca de vez en cuando: primero lo que hay que
 * resolver, después el negocio, después el crecimiento y al final la
 * configuración.
 *
 * **Solo aparecen las secciones que existen.** Las que faltan se añaden
 * cuando su fase las construye; un enlace a una ruta que aún no existe es un
 * botón muerto.
 */
export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** `/admin` no debe marcarse activo en cualquier subsección. */
  exact?: boolean;
  /** Qué contador de `ContadoresAdmin` se pinta al lado, si hay alguno. */
  contador?: keyof ContadoresAdmin;
}

export interface AdminNavGroup {
  titulo: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    titulo: "Hoy",
    items: [
      {
        href: "/admin",
        label: "Inicio",
        icon: LayoutDashboard,
        exact: true,
        contador: "pendientes",
      },
    ],
  },
  {
    titulo: "Día a día",
    items: [
      {
        href: "/admin/solicitudes",
        label: "Solicitudes",
        icon: ClipboardList,
        contador: "solicitudes",
      },
      {
        href: "/admin/soporte",
        label: "Soporte",
        icon: LifeBuoy,
        contador: "conversaciones",
      },
      {
        href: "/admin/publicaciones",
        label: "Publicaciones",
        icon: Send,
        contador: "publicaciones",
      },
    ],
  },
  {
    titulo: "Negocio",
    items: [
      { href: "/admin/negocios", label: "Negocios", icon: Store },
      { href: "/admin/ingresos", label: "Ingresos y pagos", icon: Wallet },
      { href: "/admin/afiliados", label: "Afiliados", icon: HandCoins },
      { href: "/admin/proyectos", label: "Proyectos", icon: Megaphone },
    ],
  },
  {
    titulo: "Crecimiento",
    items: [
      { href: "/admin/prospectos", label: "Prospectos", icon: Target },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      {
        href: "/admin/notificaciones",
        label: "Notificaciones",
        icon: BellRing,
      },
      { href: "/admin/prueba-onboarding", label: "Onboarding", icon: Sparkles },
    ],
  },
  {
    titulo: "Configuración",
    items: [
      {
        href: "/admin/planes",
        label: "Planes y precios",
        icon: BadgeDollarSign,
      },
      { href: "/admin/categorias", label: "Categorías", icon: Tags },
      { href: "/admin/proveedores-ia", label: "Proveedores IA", icon: Bot },
      { href: "/admin/usuarios", label: "Usuarios", icon: Users },
      {
        href: "/admin/diagnostico",
        label: "Diagnóstico",
        icon: Activity,
        contador: "diagnostico",
      },
      { href: "/admin/actividad", label: "Actividad", icon: History },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap(
  (grupo) => grupo.items,
);

/** El título de la barra superior: la sección en la que se está. */
export function tituloDeSeccion(pathname: string): string {
  const item = ADMIN_NAV_ITEMS.find((candidato) =>
    candidato.exact
      ? pathname === candidato.href
      : pathname === candidato.href ||
        pathname.startsWith(`${candidato.href}/`),
  );
  return item?.label ?? "Administración";
}

export function esItemActivo(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

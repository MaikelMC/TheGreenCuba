import {
  Accessibility,
  Beer,
  Boxes,
  CalendarCheck,
  CalendarClock,
  Cigarette,
  CircleParking,
  Leaf,
  MessageCircle,
  Mountain,
  Music,
  PawPrint,
  Plug,
  ShieldCheck,
  ShoppingBag,
  Snowflake,
  Store,
  Sun,
  Truck,
  Users,
  UtensilsCrossed,
  Wifi,
  type LucideIcon,
} from "lucide-react";

/**
 * El nombre de icono que guarda `src/lib/ficha/atributos.ts`, convertido en el
 * componente de Lucide que se pinta.
 *
 * El catálogo guarda nombres y no componentes para poder vivir en un módulo puro
 * que leen el servidor, el panel y las pruebas. El mapa de nombres a componentes
 * se queda aquí, en la capa que dibuja.
 */
export const ICONOS_ATRIBUTOS: Record<string, LucideIcon> = {
  Wifi,
  Sun,
  Snowflake,
  Music,
  CircleParking,
  PawPrint,
  Leaf,
  Plug,
  Accessibility,
  Cigarette,
  UtensilsCrossed,
  ShoppingBag,
  Users,
  Beer,
  Mountain,
  Store,
  MessageCircle,
  Boxes,
  CalendarCheck,
  CalendarClock,
  Truck,
  ShieldCheck,
};

/** El icono pedido, o `null` si el catálogo cambió y la clave ya no existe. */
export function iconoDeAtributo(nombre: string | null): LucideIcon | null {
  return nombre ? (ICONOS_ATRIBUTOS[nombre] ?? null) : null;
}

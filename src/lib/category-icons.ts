import {
  Utensils,
  UtensilsCrossed,
  ChefHat,
  Coffee,
  Beer,
  Wine,
  Martini,
  Pizza,
  Sandwich,
  Salad,
  Fish,
  IceCreamCone,
  Cake,
  Cookie,
  Store,
  ShoppingBag,
  ShoppingCart,
  ShoppingBasket,
  Package,
  Tags,
  Shirt,
  Gem,
  Watch,
  Wrench,
  Hammer,
  Plug,
  Zap,
  Scissors,
  Brush,
  SprayCan,
  Droplets,
  Wifi,
  Stethoscope,
  Pill,
  Syringe,
  HeartPulse,
  Landmark,
  BookOpen,
  Palette,
  Theater,
  Camera,
  Music,
  Mic2,
  TreePalm,
  Trees,
  Leaf,
  Flower2,
  Waves,
  Mountain,
  Sun,
  Bird,
  Umbrella,
  Car,
  Bus,
  Bike,
  Plane,
  Ship,
  Anchor,
  Fuel,
  Truck,
  Hotel,
  Bed,
  Tent,
  Home,
  DoorOpen,
  Dumbbell,
  Trophy,
  Medal,
  Goal,
  MapPin,
  Map,
  Compass,
  Navigation,
  Sparkles,
  Star,
  Crown,
  Heart,
  Building2,
  GraduationCap,
  Gamepad2,
  Church,
  type LucideIcon,
} from "lucide-react";

/**
 * Catálogo de iconos que puede llevar un negocio en La Verde.
 *
 * Vive en `lib` y no dentro de un componente porque lo usan tres sitios que no
 * tienen nada que ver entre sí: el selector de categorías del admin, el
 * formulario de negocio del admin y el panel del dueño. Estaba en
 * `components/admin/`, que es de admin, y el panel del dueño no lo es.
 *
 * El orden manda: es el orden en que salen en la rejilla del selector, así que
 * las familias que más se eligen —comida y comercio— van primero y lo raro
 * queda al final, donde hay que bajar a buscarlo.
 *
 * Los nombres son las claves de Lucide tal cual. Uno que no exista no revienta:
 * `resolveCategoryIcon` devuelve el genérico. Pero sí se queda sin dibujar, así
 * que van comprobados contra `node_modules/lucide-react/dist/esm/icons`.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // Comida y bebida
  Utensils,
  UtensilsCrossed,
  ChefHat,
  Pizza,
  Sandwich,
  Salad,
  Fish,
  IceCreamCone,
  Cake,
  Cookie,
  Coffee,
  Beer,
  Wine,
  Martini,
  // Comercio
  Store,
  ShoppingBag,
  ShoppingCart,
  ShoppingBasket,
  Package,
  Tags,
  Shirt,
  Gem,
  Watch,
  // Servicios
  Wrench,
  Hammer,
  Plug,
  Zap,
  Scissors,
  Brush,
  SprayCan,
  Droplets,
  Wifi,
  // Salud
  Stethoscope,
  Pill,
  Syringe,
  HeartPulse,
  // Cultura y ocio
  Landmark,
  BookOpen,
  Palette,
  Theater,
  Camera,
  Music,
  Mic2,
  Gamepad2,
  // Naturaleza y aire libre
  TreePalm,
  Trees,
  Leaf,
  Flower2,
  Waves,
  Mountain,
  Sun,
  Bird,
  Umbrella,
  // Transporte
  Car,
  Bus,
  Bike,
  Plane,
  Ship,
  Anchor,
  Fuel,
  Truck,
  // Hospedaje
  Hotel,
  Bed,
  Tent,
  Home,
  DoorOpen,
  // Deporte
  Dumbbell,
  Trophy,
  Medal,
  Goal,
  // Otros
  Church,
  Building2,
  GraduationCap,
  MapPin,
  Map,
  Compass,
  Navigation,
  Sparkles,
  Star,
  Crown,
  Heart,
};

export const CATEGORY_ICON_KEYS: string[] = Object.keys(CATEGORY_ICONS);

export const DEFAULT_CATEGORY_ICON = "MapPin";

/** El icono pedido, o el genérico si el nombre no está en el catálogo. */
export function resolveCategoryIcon(icon?: string): LucideIcon {
  return (icon && CATEGORY_ICONS[icon]) || CATEGORY_ICONS[DEFAULT_CATEGORY_ICON]!;
}

/** `true` si el nombre está en el catálogo. Para el pin, que no pinta React. */
export function isKnownIcon(icon?: string): boolean {
  return Boolean(icon && CATEGORY_ICONS[icon]);
}

export interface BusinessCategory {
  value: string;
  label: string;
  emoji: string;
  /** Nombre del icono Lucide usado en el panel de administración. */
  icon?: string;
}

/** Categorías disponibles al crear un negocio en La Verde (cubren todo el país). */
export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { value: "restaurante", label: "Restaurante", emoji: "🍽️", icon: "Utensils" },
  { value: "cafeteria", label: "Cafetería", emoji: "☕", icon: "Coffee" },
  { value: "discoteca", label: "Vida nocturna", emoji: "🎵", icon: "Music" },
  { value: "mercado", label: "Mercado", emoji: "🛍️", icon: "ShoppingBag" },
  { value: "tienda", label: "Tienda", emoji: "🛒", icon: "ShoppingCart" },
  { value: "servicio", label: "Servicio", emoji: "🛠️", icon: "Wrench" },
  { value: "bar", label: "Bar", emoji: "🍻", icon: "Wine" },
  { value: "hospedaje", label: "Hospedaje", emoji: "🏨", icon: "Hotel" },
  { value: "cultura", label: "Cultura", emoji: "🎭", icon: "Landmark" },
  { value: "naturaleza", label: "Naturaleza", emoji: "🌿", icon: "Leaf" },
  { value: "playa", label: "Playa", emoji: "🏖️", icon: "Umbrella" },
  { value: "otro", label: "Otro", emoji: "📍", icon: "MapPin" },
];

export const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  BUSINESS_CATEGORIES.map((c) => [c.label, c.emoji]),
);

export function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? "📍";
}

export const CATEGORY_ICON: Record<string, string> = Object.fromEntries(
  BUSINESS_CATEGORIES.map((c) => [c.label, c.icon ?? "MapPin"]),
);

export function categoryIcon(category: string): string {
  return CATEGORY_ICON[category] ?? "MapPin";
}

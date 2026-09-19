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

/**
 * Icono de una categoría, por su etiqueta.
 *
 * El segundo argumento existe porque hay dos catálogos: el estático de arriba y
 * el que el admin edita en `/admin/categorias`, que se guarda en
 * `la-verde:categories`. Sin él, cambiar el icono de una categoría en el admin
 * no movería ni un pin. Quien tenga el almacén a mano lo pasa; quien no, se
 * queda con el estático.
 */
export function categoryIcon(
  category: string,
  categories?: BusinessCategory[],
): string {
  const edited = categories?.find((c) => c.label === category)?.icon;
  return edited ?? CATEGORY_ICON[category] ?? "MapPin";
}

/**
 * Icono de un negocio: el suyo si lo eligió, y si no el de su categoría. La
 * regla va aquí y no repetida en cada sitio que pinta un negocio, para que el
 * pin, el popup y la tarjeta no puedan discrepar.
 */
export function placeIcon(
  icon: string | undefined,
  category: string,
  categories?: BusinessCategory[],
): string {
  return icon && icon.trim() !== "" ? icon : categoryIcon(category, categories);
}

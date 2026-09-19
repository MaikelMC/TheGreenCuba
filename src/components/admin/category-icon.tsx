"use client";

import { resolveCategoryIcon } from "@/lib/category-icons";

/* El catálogo se mudó a `src/lib/category-icons.ts` —lo usa también el panel
   del dueño, que no es admin— y aquí se reexporta para no tocar a quien ya
   importaba desde este archivo. Este módulo se queda con lo que sí es de
   componente: pintar el icono. */
export {
  CATEGORY_ICONS,
  CATEGORY_ICON_KEYS,
  DEFAULT_CATEGORY_ICON,
  resolveCategoryIcon,
} from "@/lib/category-icons";

interface CategoryIconProps {
  icon?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CategoryIcon({
  icon,
  size = 18,
  strokeWidth = 1.8,
  className,
}: CategoryIconProps) {
  const Icon = resolveCategoryIcon(icon);
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
}

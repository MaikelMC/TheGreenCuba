"use client";

import {
  Utensils,
  Coffee,
  Music,
  ShoppingBag,
  ShoppingCart,
  Wrench,
  MapPin,
  Sparkles,
  Martini,
  Cake,
  TreePalm,
  Car,
  Hotel,
  Plane,
  Crown,
  Star,
  Heart,
  Dumbbell,
  Scissors,
  Brush,
  BookOpen,
  Gamepad2,
  Bike,
  Bus,
  Store,
  Building2,
  GraduationCap,
  Stethoscope,
  Droplets,
  Wifi,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Utensils,
  Coffee,
  Music,
  ShoppingBag,
  ShoppingCart,
  Wrench,
  MapPin,
  Sparkles,
  Martini,
  Cake,
  TreePalm,
  Car,
  Hotel,
  Plane,
  Crown,
  Star,
  Heart,
  Dumbbell,
  Scissors,
  Brush,
  BookOpen,
  Gamepad2,
  Bike,
  Bus,
  Store,
  Building2,
  GraduationCap,
  Stethoscope,
  Droplets,
  Wifi,
};

export const CATEGORY_ICON_KEYS: string[] = Object.keys(CATEGORY_ICONS);

export const DEFAULT_CATEGORY_ICON = "MapPin";

export function resolveCategoryIcon(icon?: string): LucideIcon {
  return (
    (icon && CATEGORY_ICONS[icon]) ||
    CATEGORY_ICONS[DEFAULT_CATEGORY_ICON]!
  );
}

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

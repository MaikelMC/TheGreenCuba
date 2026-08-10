import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-CU").format(n);
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("es-CU", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(n);
}

export function cx(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatPrice(price: number, currency = "MLC"): string {
  const symbols: Record<string, string> = { MLC: "MLC", CUP: "$", USD: "USD", EUR: "€" };
  return `${price.toFixed(2)} ${symbols[currency] ?? currency}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateId(): string {
  const { nanoid } = require("nanoid");
  return nanoid(12);
}

import { BUSINESS_CATEGORIES, type BusinessCategory } from "@/lib/places";

const STORAGE_KEY = "la-verde:categories";

export function readCategories(): BusinessCategory[] {
  if (typeof window === "undefined") return BUSINESS_CATEGORIES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return BUSINESS_CATEGORIES;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return BUSINESS_CATEGORIES;
    const valid = parsed.filter(
      (c): c is BusinessCategory =>
        !!c &&
        typeof c.value === "string" &&
        typeof c.label === "string" &&
        typeof c.emoji === "string",
    );
    return valid.length > 0 ? valid : BUSINESS_CATEGORIES;
  } catch {
    return BUSINESS_CATEGORIES;
  }
}

export function writeCategories(categories: BusinessCategory[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch {
    // localStorage unavailable — ignore
  }
}

export function addCategoryToStorage(category: BusinessCategory): void {
  writeCategories([...readCategories(), category]);
}

export function updateCategoryInStorage(
  value: string,
  patch: Partial<Pick<BusinessCategory, "label" | "emoji" | "value" | "icon">>,
): void {
  writeCategories(
    readCategories().map((c) =>
      c.value === value ? { ...c, ...patch } : c,
    ),
  );
}

export function removeCategoryFromStorage(value: string): void {
  writeCategories(readCategories().filter((c) => c.value !== value));
}

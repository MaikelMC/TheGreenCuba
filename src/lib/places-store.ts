export type PlaceStatus = "active" | "closed" | "temporary_closed";

export interface UserPlaceMenuItem {
  name: string;
  description: string;
  price: string;
  currency: string;
}

export interface UserPlaceOffer {
  text: string;
  expiry: string;
}

export interface UserPlaceSlide {
  gradient: string;
  label: string;
}

export interface UserPlace {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  barrio: string;
  description: string;
  schedule: string;
  payments: string[];
  menu: UserPlaceMenuItem[];
  offer: UserPlaceOffer | null;
  status: PlaceStatus;
  isBoosted: boolean;
  boostExpiresAt: string;
  rating?: number;
  slides?: UserPlaceSlide[];
  aiReasoning?: string;
  aiTags?: string[];
  distanceLabel?: string;
  priceLabel?: string;
  createdAt: number;
  updatedAt?: number;
}

export type NewUserPlace = Omit<
  UserPlace,
  "id" | "createdAt" | "updatedAt"
> &
  Partial<Pick<UserPlace, "status" | "isBoosted" | "boostExpiresAt">>;

export type UserPlacePatch = Partial<
  Omit<UserPlace, "id" | "createdAt" | "updatedAt">
>;

const STORAGE_KEY = "la-verde:places";

export function createUserPlaceId(): string {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseStatus(v: unknown): PlaceStatus {
  return v === "closed" || v === "temporary_closed" ? v : "active";
}

function parseSlides(v: unknown): UserPlaceSlide[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const slides = v
    .filter(
      (s) =>
        !!s &&
        typeof s.gradient === "string" &&
        typeof s.label === "string",
    )
    .map((s) => ({ gradient: s.gradient as string, label: s.label as string }));
  return slides.length > 0 ? slides : undefined;
}

function parseMenu(v: unknown): UserPlaceMenuItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (m) =>
        !!m &&
        typeof m.name === "string" &&
        typeof m.price === "string" &&
        typeof m.currency === "string",
    )
    .map((m) => ({
      name: m.name as string,
      description: typeof m.description === "string" ? m.description : "",
      price: m.price as string,
      currency: m.currency as string,
    }));
}

export function readUserPlaces(): UserPlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p) =>
          !!p &&
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng),
      )
      .map((p) => ({
        id: p.id as string,
        name: p.name as string,
        category: typeof p.category === "string" ? p.category : "Otro",
        lat: p.lat as number,
        lng: p.lng as number,
        address: typeof p.address === "string" ? p.address : "",
        barrio: typeof p.barrio === "string" ? p.barrio : "",
        description: typeof p.description === "string" ? p.description : "",
        schedule: typeof p.schedule === "string" ? p.schedule : "",
        payments: Array.isArray(p.payments)
          ? (p.payments as unknown[]).filter(
              (x): x is string => typeof x === "string",
            )
          : [],
        menu: parseMenu(p.menu),
        offer:
          p.offer && typeof p.offer === "object" && typeof p.offer.text === "string"
            ? {
                text: p.offer.text,
                expiry: typeof p.offer.expiry === "string" ? p.offer.expiry : "",
              }
            : null,
        status: parseStatus(p.status),
        isBoosted: Boolean(p.isBoosted),
        boostExpiresAt:
          typeof p.boostExpiresAt === "string" ? p.boostExpiresAt : "",
        rating: typeof p.rating === "number" && p.rating > 0 ? p.rating : undefined,
        slides: parseSlides(p.slides),
        aiReasoning: typeof p.aiReasoning === "string" ? p.aiReasoning : undefined,
        aiTags: Array.isArray(p.aiTags)
          ? (p.aiTags as unknown[]).filter(
              (x): x is string => typeof x === "string",
            )
          : undefined,
        distanceLabel:
          typeof p.distanceLabel === "string" ? p.distanceLabel : undefined,
        priceLabel: typeof p.priceLabel === "string" ? p.priceLabel : undefined,
        createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
        updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : undefined,
      }));
  } catch {
    return [];
  }
}

export function writeUserPlaces(places: UserPlace[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  } catch {
    // localStorage unavailable (privacy mode / SSR) — ignore
  }
}

export function addUserPlaceToStorage(place: UserPlace): void {
  writeUserPlaces([...readUserPlaces(), place]);
}

export function updateUserPlaceInStorage(
  id: string,
  patch: UserPlacePatch,
): UserPlace[] {
  const next = readUserPlaces().map((p) =>
    p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
  );
  writeUserPlaces(next);
  return next;
}

export function removeUserPlaceFromStorage(id: string): void {
  writeUserPlaces(readUserPlaces().filter((p) => p.id !== id));
}

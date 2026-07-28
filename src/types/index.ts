import { z } from "zod";

// ─── Enums ───
export type PlaceStatus = "active" | "closed" | "temporary_closed";
export type OwnerRole = "owner" | "manager" | "editor";
export type Currency = "MLC" | "CUP" | "USD" | "EUR";
export type MenuItemTag = "popular" | "new" | "offer";
export type SearchType = "natural_language" | "keyword" | "voice";

// ─── Base Entities ───
export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  locationCity: string | null;
  locationLat: string | null;
  locationLng: string | null;
  onboardingCompleted: boolean;
  preferences: UserPreferences | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  interests?: string[];
  currencies?: string[];
  moods?: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
}

export interface Place {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  categoryId: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string;
  province: string;
  neighborhood: string | null;
  phone: string | null;
  website: string | null;
  hoursJson: Record<string, { open: string; close: string } | null> | null;
  paymentMethods: string[] | null;
  currencies: string[] | null;
  priceLevel: number;
  vibe: string[] | null;
  tags: string[] | null;
  isActive: boolean;
  isBoosted: boolean;
  boostExpiresAt: Date | null;
  status: PlaceStatus;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaceImage {
  id: string;
  placeId: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  isCover: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface PlaceHours {
  id: string;
  placeId: string;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

export interface PlaceMenuItem {
  id: string;
  placeId: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: Currency;
  imageUrl: string | null;
  tag: MenuItemTag | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Review {
  id: string;
  placeId: string;
  userId: string;
  rating: number;
  content: string | null;
  createdAt: Date;
}

export interface SavedPlace {
  id: string;
  userId: string;
  placeId: string;
  note: string | null;
  createdAt: Date;
}

export interface BusinessOwner {
  id: string;
  userId: string;
  placeId: string;
  role: OwnerRole;
  invitedAt: Date;
  acceptedAt: Date | null;
}

// ─── API Types ───
export interface SearchQuery {
  query: string;
  lat?: number;
  lng?: number;
  city?: string;
  category?: string;
  currencies?: string[];
  vibe?: string[];
  openNow?: boolean;
  limit?: number;
}

export interface SearchResult {
  place: Place;
  category: Category;
  images: PlaceImage[];
  distance?: number;
  isOpen?: boolean;
  relevance?: number;
  aiReasoning?: string;
}

export interface AIRecommendation {
  query: string;
  reasoning: string;
  results: SearchResult[];
  suggestedFilters?: string[];
}

// ─── Zod Schemas ───
export const searchQuerySchema = z.object({
  query: z.string().min(1).max(500),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  city: z.string().optional(),
  category: z.string().optional(),
  currencies: z.array(z.enum(["MLC", "CUP", "USD", "EUR"])).optional(),
  vibe: z.array(z.string()).optional(),
  openNow: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export const placeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  shortDescription: z.string().max(300).optional(),
  categoryId: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  address: z.string().max(500).optional(),
  city: z.string().min(1).max(100),
  province: z.string().min(1).max(100),
  neighborhood: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  website: z.string().url().optional(),
  paymentMethods: z.array(z.string()).optional(),
  currencies: z.array(z.enum(["MLC", "CUP", "USD", "EUR"])).optional(),
  priceLevel: z.coerce.number().min(1).max(4).optional(),
  vibe: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

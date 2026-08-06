"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addUserPlaceToStorage,
  createUserPlaceId,
  readUserPlaces,
  removeUserPlaceFromStorage,
  updateUserPlaceInStorage,
  writeUserPlaces,
  type NewUserPlace,
  type UserPlace,
  type UserPlacePatch,
} from "@/lib/places-store";
import { SEED_PLACES } from "@/lib/seed-places";
import {
  addCategoryToStorage,
  readCategories,
  removeCategoryFromStorage,
  updateCategoryInStorage,
} from "@/lib/categories-store";
import type { BusinessCategory } from "@/lib/places";

interface CategoryInput {
  name: string;
  emoji: string;
  value: string;
  icon?: string;
}

interface PlacesContextValue {
  places: UserPlace[];
  categories: BusinessCategory[];
  addPlace: (input: NewUserPlace) => UserPlace;
  updatePlace: (id: string, patch: UserPlacePatch) => void;
  removePlace: (id: string) => void;
  addCategory: (input: CategoryInput) => void;
  updateCategory: (
    value: string,
    patch: Partial<Pick<BusinessCategory, "label" | "emoji" | "value" | "icon">>,
  ) => void;
  removeCategory: (value: string) => void;
}

const PlacesContext = createContext<PlacesContextValue | null>(null);

export function PlacesProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<UserPlace[]>([]);
  const [categories, setCategories] = useState<BusinessCategory[]>([]);

  useEffect(() => {
    const existing = readUserPlaces();
    const missing = SEED_PLACES.filter(
      (s) => !existing.some((e) => e.id === s.id),
    );
    if (missing.length > 0) {
      writeUserPlaces([...missing, ...existing]);
    }
    setPlaces(readUserPlaces());
    setCategories(readCategories());
  }, []);

  const addPlace = useCallback((input: NewUserPlace): UserPlace => {
    const place: UserPlace = {
      ...input,
      id: createUserPlaceId(),
      createdAt: Date.now(),
      status: input.status ?? "active",
      isBoosted: input.isBoosted ?? false,
      boostExpiresAt: input.boostExpiresAt ?? "",
    };
    addUserPlaceToStorage(place);
    setPlaces((prev) => [...prev, place]);
    return place;
  }, []);

  const updatePlace = useCallback((id: string, patch: UserPlacePatch) => {
    setPlaces(updateUserPlaceInStorage(id, patch));
  }, []);

  const removePlace = useCallback((id: string) => {
    removeUserPlaceFromStorage(id);
    setPlaces((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addCategory = useCallback((input: CategoryInput) => {
    addCategoryToStorage({
      label: input.name,
      emoji: input.emoji,
      value: input.value,
      icon: input.icon,
    });
    setCategories(readCategories());
  }, []);

  const updateCategory = useCallback(
    (value: string, patch: Partial<Pick<BusinessCategory, "label" | "emoji" | "value" | "icon">>) => {
      updateCategoryInStorage(value, patch);
      setCategories(readCategories());
    },
    [],
  );

  const removeCategory = useCallback((value: string) => {
    removeCategoryFromStorage(value);
    setCategories(readCategories());
  }, []);

  const value = useMemo(
    () => ({
      places,
      categories,
      addPlace,
      updatePlace,
      removePlace,
      addCategory,
      updateCategory,
      removeCategory,
    }),
    [places, categories, addPlace, updatePlace, removePlace, addCategory, updateCategory, removeCategory],
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlaces(): PlacesContextValue {
  const ctx = useContext(PlacesContext);
  if (!ctx) throw new Error("usePlaces debe usarse dentro de <PlacesProvider>");
  return ctx;
}

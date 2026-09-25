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
import type { NewUserPlace, UserPlace, UserPlacePatch } from "@/lib/places-store";
import type { BusinessCategory } from "@/lib/places";

/**
 * El catálogo, servido desde Neon.
 *
 * Antes esto leía `localStorage` y sembraba con una lista del código. Ahora la
 * base es la única fuente: se carga por `/api/places` y `/api/categories` al
 * montar, y cada mutación va al servidor y espera su respuesta.
 *
 * **Las mutaciones son `async` y devuelven si salieron bien.** No es un detalle
 * de estilo: quien llama tiene que saber si el guardado llegó antes de decirle
 * al usuario «guardado». Los dos sitios que avisan con un `toast` comprueban el
 * valor — si no, un fallo de red se celebraba como un éxito y el negocio
 * desaparecía al recargar.
 *
 * Se descartó escribir en `localStorage` a la vez que en la base: dos fuentes
 * que se separan en cuanto una falla, sin forma de saber cuál manda.
 */

interface CategoryInput {
  name: string;
  emoji: string;
  value: string;
  icon?: string;
}

interface PlacesContextValue {
  places: UserPlace[];
  categories: BusinessCategory[];
  /**
   * `false` hasta que llegó la primera respuesta. Sin esto no se puede
   * distinguir "todavía no cargó" de "no hay nada", y los estados vacíos
   * parpadean al montar.
   */
  hydrated: boolean;
  /** Mensaje del último fallo. Los paneles lo pintan tal cual. */
  error: string | null;
  /**
   * Vuelve a pedir el catálogo entero. Lo usa el editor de fotos: las fotos
   * viajan por su propia ruta, así que la copia que tiene el provider se queda
   * sin ellas y la ficha pública —que lee de aquí— no las enseñaría hasta
   * recargar.
   */
  refreshPlaces: () => Promise<void>;
  addPlace: (input: NewUserPlace) => Promise<UserPlace | null>;
  updatePlace: (id: string, patch: UserPlacePatch) => Promise<UserPlace | null>;
  removePlace: (id: string, message?: string) => Promise<boolean>;
  addCategory: (input: CategoryInput) => Promise<BusinessCategory | null>;
  updateCategory: (
    value: string,
    patch: Partial<Pick<BusinessCategory, "label" | "emoji" | "value" | "icon">>,
  ) => Promise<boolean>;
  removeCategory: (value: string) => Promise<boolean>;
}

const PlacesContext = createContext<PlacesContextValue | null>(null);

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Una llamada a la API que nunca lanza: el fallo se devuelve, no se propaga. */
async function request<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(url, init);
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = (payload as { error?: unknown } | null)?.error;
      return {
        ok: false,
        error: typeof detail === "string" ? detail : `El servidor respondió ${res.status}.`,
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    /* `fetch` solo lanza si no hubo respuesta: red caída, servidor apagado. */
    return { ok: false, error: "No se pudo conectar con el servidor." };
  }
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function PlacesProvider({
  children,
  initialPlaces,
  initialCategories,
  includeUnpublished = false,
}: {
  children: ReactNode;
  /**
   * Si el catálogo que pide este árbol incluye los negocios sin publicar.
   *
   * Público por defecto y **a propósito**: `/api/places` devuelve solo lo
   * publicado salvo que le pidan lo contrario, y el único árbol que necesita
   * verlo todo es `/admin`, que tiene que poder aprobar lo que está pendiente y
   * reabrir lo cerrado. Antes el defecto era el contrario —la ruta devolvía todo
   * y el filtro había que pedirlo—, y el resultado era que un negocio apagado
   * por administración seguía saliendo en el mapa con su pin.
   */
  includeUnpublished?: boolean;
  /**
   * El catálogo ya resuelto en el servidor, cuando quien monta el provider es un
   * componente de servidor que puede leerlo —hoy, el layout de `/admin`—.
   *
   * Con esto el panel arranca con los datos puestos: antes pintaba vacío y el
   * usuario esperaba a que volvieran **dos** peticiones (`/api/places` y
   * `/api/categories`) para ver algo, que es exactamente el «recargo y espero» de
   * un panel de administración. Se ahorra la ida y vuelta entera y, de paso, la
   * pantalla de carga.
   *
   * Van juntos a propósito: por uno solo no se ahorra nada —la petición que
   * falta hay que hacerla igual— así que o llegan los dos o no llega ninguno.
   */
  initialPlaces?: UserPlace[];
  initialCategories?: BusinessCategory[];
}) {
  const hasInitialData =
    initialPlaces !== undefined && initialCategories !== undefined;

  const [places, setPlaces] = useState<UserPlace[]>(initialPlaces ?? []);
  const [categories, setCategories] = useState<BusinessCategory[]>(
    initialCategories ?? [],
  );
  const [hydrated, setHydrated] = useState(hasInitialData);
  const [error, setError] = useState<string | null>(null);

  /* La consulta del catálogo, atada al prop. Es una constante mientras el prop
     no cambie, que es lo que necesita el `useCallback` de abajo para no
     reconstruirse en cada render. */
  const placesQuery = includeUnpublished ? "?all=true" : "";

  useEffect(() => {
    /* Con datos del servidor no se pide nada. `hasInitialData` es un booleano
       estable, así que el efecto sigue corriendo una sola vez. */
    if (hasInitialData) return;

    let cancelled = false;

    (async () => {
      const [placesResult, categoriesResult] = await Promise.all([
        request<UserPlace[]>(`/api/places${placesQuery}`),
        request<BusinessCategory[]>("/api/categories"),
      ]);
      if (cancelled) return;

      if (placesResult.ok) setPlaces(placesResult.data);
      else setError(placesResult.error);

      if (categoriesResult.ok) setCategories(categoriesResult.data);
      else setError(categoriesResult.error);

      setHydrated(true);
    })();

    /* Sin esto, desmontar durante la carga deja un `setState` sobre un
       componente que ya no está. */
    return () => {
      cancelled = true;
    };
  }, [hasInitialData, placesQuery]);

  const refreshPlaces = useCallback(async () => {
    /* Con la consulta del prop y no sin ella: el panel de administración
       refresca después de cada cambio —subir una foto lo hace, por ejemplo— y
       pidiendo el catálogo público la lista perdería de golpe los negocios
       pendientes y cerrados, que son justo los que está mirando. */
    const result = await request<UserPlace[]>(`/api/places${placesQuery}`);
    if (result.ok) setPlaces(result.data);
    else setError(result.error);
  }, [placesQuery]);

  const addPlace = useCallback(async (input: NewUserPlace) => {
    const result = await request<UserPlace>("/api/places", json("POST", input));
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setError(null);
    setPlaces((prev) => [...prev, result.data]);
    return result.data;
  }, []);

  const updatePlace = useCallback(async (id: string, patch: UserPlacePatch) => {
    const result = await request<UserPlace>(`/api/places/${encodeURIComponent(id)}`, json("PATCH", patch));
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setError(null);
    setPlaces((prev) => prev.map((p) => (p.id === id ? result.data : p)));
    return result.data;
  }, []);

  const removePlace = useCallback(async (id: string, message?: string) => {
    const result = await request<{ id: string }>(
      `/api/places/${encodeURIComponent(id)}`,
      json("DELETE", { message }),
    );
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setPlaces((prev) => prev.filter((p) => p.id !== id));
    return true;
  }, []);

  const addCategory = useCallback(async (input: CategoryInput) => {
    const result = await request<BusinessCategory>("/api/categories", json("POST", input));
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setError(null);
    setCategories((prev) => [...prev, result.data]);
    return result.data;
  }, []);

  const updateCategory = useCallback(
    async (
      value: string,
      patch: Partial<Pick<BusinessCategory, "label" | "emoji" | "value" | "icon">>,
    ) => {
      const result = await request<BusinessCategory>(
        `/api/categories/${encodeURIComponent(value)}`,
        json("PATCH", patch),
      );
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setError(null);
      /* Se casa por el valor viejo: si el cambio era justo la clave, el nuevo
         no coincide con nada de la lista y la fila se quedaría sin actualizar. */
      setCategories((prev) =>
        prev.map((c) => (c.value === value ? result.data : c)),
      );
      return true;
    },
    [],
  );

  const removeCategory = useCallback(async (value: string) => {
    const result = await request<{ value: string }>(
      `/api/categories/${encodeURIComponent(value)}`,
      { method: "DELETE" },
    );
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setCategories((prev) => prev.filter((c) => c.value !== value));
    return true;
  }, []);

  const value = useMemo(
    () => ({
      places,
      categories,
      hydrated,
      error,
      refreshPlaces,
      addPlace,
      updatePlace,
      removePlace,
      addCategory,
      updateCategory,
      removeCategory,
    }),
    [
      places,
      categories,
      hydrated,
      error,
      refreshPlaces,
      addPlace,
      updatePlace,
      removePlace,
      addCategory,
      updateCategory,
      removeCategory,
    ],
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlaces(): PlacesContextValue {
  const ctx = useContext(PlacesContext);
  if (!ctx) throw new Error("usePlaces debe usarse dentro de <PlacesProvider>");
  return ctx;
}

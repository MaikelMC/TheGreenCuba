"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  /* Ya no se pinta en ninguna vista: las categorías se representan con su
     icono. El campo sigue existiendo en la base y en la API por compatibilidad. */
  emoji?: string;
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
  /** El último fallo, sin esperar al render. `null` si no hubo. */
  ultimoError: () => string | null;
  /**
   * Cuándo se trajo el catálogo por última vez, en epoch ms.
   *
   * Vale tanto para una respuesta de red como para una copia servida por el
   * service worker. Se guarda en `localStorage` para que el dato sobreviva a una
   * recarga sin red: sin él, la pantalla offline no podría decir de cuándo son
   * los datos.
   */
  lastSyncedAt: number | null;
  /** `true` si la última respuesta la sirvió la caché del service worker. */
  fromCache: boolean;
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

type Result<T> =
  | { ok: true; data: T; cachedAt: number | null }
  | { ok: false; error: string };

const CLAVE_SINCRONIA = "la-verde:catalog-synced-at";

/**
 * Copia del catálogo en el navegador, para pintar antes de que conteste la red.
 *
 * Cada carga de página pedía `/api/places` y esperaba la respuesta para enseñar
 * el mapa y la lista: en una conexión lenta eso son varios segundos de
 * esqueletos en cada visita, aunque el catálogo sea el mismo de hace un minuto.
 * Con la copia, la segunda visita pinta los pines y las tarjetas de inmediato y
 * la petición sigue por detrás para refrescar (`Cache-Control: max-age=60`, así
 * que casi siempre sale de la caché HTTP sin tocar la base).
 *
 * No es una segunda fuente de verdad: la respuesta de red siempre la sustituye,
 * y si no llega se ve lo último guardado con su fecha en el subtítulo de la
 * hoja. Se descarta por sí sola a los siete días y cuando cambia la versión —
 * el día que cambie la forma de `UserPlace`— para no pintar datos de un
 * contrato viejo.
 */
const CLAVE_COPIA = "la-verde:catalogo-copia";
const COPIA_VERSION = 1;
const COPIA_MAX_EDAD_MS = 7 * 24 * 60 * 60 * 1000;

interface CopiaCatalogo {
  v: number;
  /** Epoch ms del momento en que se trajo de la red. */
  at: number;
  places: UserPlace[];
  categories: BusinessCategory[];
}

function leerCopia(): CopiaCatalogo | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(CLAVE_COPIA);
    if (!crudo) return null;
    const copia = JSON.parse(crudo) as CopiaCatalogo | null;
    if (!copia || copia.v !== COPIA_VERSION) return null;
    if (!Array.isArray(copia.places) || !Array.isArray(copia.categories)) return null;
    if (!Number.isFinite(copia.at) || Date.now() - copia.at > COPIA_MAX_EDAD_MS) {
      return null;
    }
    return copia;
  } catch {
    return null;
  }
}

function guardarCopia(
  places: UserPlace[],
  categories: BusinessCategory[],
  at: number,
): void {
  try {
    const copia: CopiaCatalogo = { v: COPIA_VERSION, at, places, categories };
    window.localStorage.setItem(CLAVE_COPIA, JSON.stringify(copia));
  } catch {
    /* Cuota llena o modo privado: sin copia, todo sigue funcionando. */
  }
}

function leerSincronia(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const guardado = window.localStorage.getItem(CLAVE_SINCRONIA);
    const valor = guardado ? Number(guardado) : NaN;
    return Number.isFinite(valor) ? valor : null;
  } catch {
    return null;
  }
}

function guardarSincronia(valor: number): void {
  try {
    window.localStorage.setItem(CLAVE_SINCRONIA, String(valor));
  } catch {
    // Sin localStorage el dato vive lo que dure la pestaña.
  }
}

/**
 * Una llamada a la API que nunca lanza: el fallo se devuelve, no se propaga.
 *
 * `X-LV-Cached-At` lo pone el service worker al guardar una copia de
 * `/api/places`. Si viene, la respuesta salió de caché y la fecha es la del
 * momento en que se guardó, no la de ahora.
 */
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
    const cachedAtRaw = res.headers.get("X-LV-Cached-At");
    const cachedAt = cachedAtRaw ? Date.parse(cachedAtRaw) : NaN;
    return {
      ok: true,
      data: payload as T,
      cachedAt: Number.isFinite(cachedAt) ? cachedAt : null,
    };
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
  /* El mismo mensaje que `error`, legible en el acto.
     Las mutaciones devuelven `null` cuando fallan, y quien llama necesita
     contar **por qué** sin esperar al siguiente render: el estado de React que
     acaba de cambiar sigue siendo el viejo en la continuación del `await`. Sin
     esto, un 400 del servidor («Configuración de entrega inválida.») se pintaba
     como «revisa la conexión», que manda a mirar la red cuando el problema
     está en el cuerpo. */
  const errorRef = useRef<string | null>(null);
  const anotarError = useCallback((mensaje: string | null) => {
    errorRef.current = mensaje;
    setError(mensaje);
  }, []);
  const ultimoError = useCallback(() => errorRef.current, []);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const anotarSincronia = useCallback((placesResult: Result<unknown>) => {
    if (!placesResult.ok) return;
    const sello = placesResult.cachedAt ?? Date.now();
    setLastSyncedAt(sello);
    setFromCache(placesResult.cachedAt !== null);
    guardarSincronia(sello);
  }, []);

  /* La consulta del catálogo, atada al prop. Es una constante mientras el prop
     no cambie, que es lo que necesita el `useCallback` de abajo para no
     reconstruirse en cada render. */
  const placesQuery = includeUnpublished ? "?all=true" : "";

  useEffect(() => {
    /* Con datos del servidor no se pide nada. `hasInitialData` es un booleano
       estable, así que el efecto sigue corriendo una sola vez. */
    if (hasInitialData) return;

    let cancelled = false;

    /* La fecha guardada se pinta antes de que llegue la respuesta. Si no hay
       red y el service worker no tiene copia, es lo único que queda. */
    const guardada = leerSincronia();
    if (guardada) setLastSyncedAt(guardada);

    /* La copia primero y la red después: el mapa y la lista aparecen con lo
       último conocido y se sustituyen cuando la respuesta aterriza. En una
       visita anterior esto se notaba como segundos de esqueleto con el mismo
       catálogo de siempre. */
    const copia = leerCopia();
    if (copia) {
      setPlaces(copia.places);
      setCategories(copia.categories);
      setLastSyncedAt(copia.at);
      setHydrated(true);
    }

    (async () => {
      const [placesResult, categoriesResult] = await Promise.all([
        request<UserPlace[]>(`/api/places${placesQuery}`),
        request<BusinessCategory[]>("/api/categories"),
      ]);
      if (cancelled) return;

      if (placesResult.ok) {
        setPlaces(placesResult.data);
        anotarSincronia(placesResult);
      } else anotarError(placesResult.error);

      if (categoriesResult.ok) setCategories(categoriesResult.data);
      else anotarError(categoriesResult.error);

      setHydrated(true);
    })();

    /* Sin esto, desmontar durante la carga deja un `setState` sobre un
       componente que ya no está. */
    return () => {
      cancelled = true;
    };
  }, [hasInitialData, placesQuery, anotarSincronia]);

  /* Cada vez que cambia el catálogo —respuesta de red o mutación del panel—
     se guarda la copia, con la fecha de la última traída para poder decir de
     cuándo son los datos. El panel de administración queda fuera: su catálogo
     incluye lo apagado y no debe acabar en la copia pública. */
  useEffect(() => {
    if (includeUnpublished || !hydrated) return;
    if (places.length === 0) return;
    guardarCopia(places, categories, lastSyncedAt ?? Date.now());
  }, [places, categories, lastSyncedAt, hydrated, includeUnpublished]);

  const refreshPlaces = useCallback(async () => {
    /* Con la consulta del prop y no sin ella: el panel de administración
       refresca después de cada cambio —subir una foto lo hace, por ejemplo— y
       pidiendo el catálogo público la lista perdería de golpe los negocios
       pendientes y cerrados, que son justo los que está mirando. */
    const result = await request<UserPlace[]>(`/api/places${placesQuery}`);
    if (result.ok) {
      setPlaces(result.data);
      anotarError(null);
      anotarSincronia(result);
    } else anotarError(result.error);
  }, [placesQuery, anotarSincronia]);

  /* Al recuperar la conexión se refresca una vez sola. No hay bucle: el permiso
     se rearma cuando se vuelve a perder la red, no en cada evento `online`. */
  const yaRefrescado = useRef(false);
  useEffect(() => {
    const alVolver = () => {
      if (yaRefrescado.current) return;
      yaRefrescado.current = true;
      void refreshPlaces();
    };
    const alPerder = () => {
      yaRefrescado.current = false;
    };
    window.addEventListener("online", alVolver);
    window.addEventListener("offline", alPerder);
    return () => {
      window.removeEventListener("online", alVolver);
      window.removeEventListener("offline", alPerder);
    };
  }, [refreshPlaces]);

  const addPlace = useCallback(async (input: NewUserPlace) => {
    const result = await request<UserPlace>("/api/places", json("POST", input));
    if (!result.ok) {
      anotarError(result.error);
      return null;
    }
    anotarError(null);
    setPlaces((prev) => [...prev, result.data]);
    return result.data;
  }, []);

  const updatePlace = useCallback(async (id: string, patch: UserPlacePatch) => {
    const result = await request<UserPlace>(`/api/places/${encodeURIComponent(id)}`, json("PATCH", patch));
    if (!result.ok) {
      anotarError(result.error);
      return null;
    }
    anotarError(null);
    setPlaces((prev) => prev.map((p) => (p.id === id ? result.data : p)));
    return result.data;
  }, []);

  const removePlace = useCallback(async (id: string, message?: string) => {
    const result = await request<{ id: string }>(
      `/api/places/${encodeURIComponent(id)}`,
      json("DELETE", { message }),
    );
    if (!result.ok) {
      anotarError(result.error);
      return false;
    }
    anotarError(null);
    setPlaces((prev) => prev.filter((p) => p.id !== id));
    return true;
  }, []);

  const addCategory = useCallback(async (input: CategoryInput) => {
    const result = await request<BusinessCategory>("/api/categories", json("POST", input));
    if (!result.ok) {
      anotarError(result.error);
      return null;
    }
    anotarError(null);
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
        anotarError(result.error);
        return false;
      }
      anotarError(null);
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
      anotarError(result.error);
      return false;
    }
    anotarError(null);
    setCategories((prev) => prev.filter((c) => c.value !== value));
    return true;
  }, []);

  const value = useMemo(
    () => ({
      places,
      categories,
      hydrated,
      error,
      ultimoError,
      lastSyncedAt,
      fromCache,
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
      ultimoError,
      lastSyncedAt,
      fromCache,
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

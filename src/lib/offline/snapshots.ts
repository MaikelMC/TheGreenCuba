/**
 * Forma de los snapshots que se guardan para el modo offline.
 *
 * Se declaran aquí y no en el panel porque `public/offline.html` lee los mismos
 * registros desde JavaScript plano: este archivo documenta el contrato. Si
 * cambia una clave, cambian los dos.
 *
 * Lo que se guarda es una **copia saneada**: campos elegidos uno a uno, nunca el
 * objeto entero. Así no se cuelan tokens, ids internos ni datos de otros
 * negocios de la misma cuenta.
 */

import type { VisitasPanel } from "@/lib/eventos";
import type { PermisoNegocio } from "@/lib/permisos-negocio";
import type { ClaveModulo, Funcion, Plan } from "@/lib/plans";
import type { PlaceStatus, UserPlace } from "@/lib/places-store";

export interface NegocioSnapshotData {
  place: {
    id: string;
    slug: string;
    name: string;
    description: string;
    address: string;
    city?: string;
    province?: string;
    phone?: string;
    whatsapp?: string;
    schedule: string;
    status: PlaceStatus;
    logoUrl?: string;
    /** Solo URLs: la app no guarda bytes de fotos en IndexedDB. */
    photos: { url: string; alt: string | null }[];
    menu: {
      id?: string;
      name: string;
      price: string;
      currency: string;
      category?: string;
      disponibilidad?: string;
      agotadoHasta?: number | null;
      image?: string;
    }[];
  };
  stats: { saved: number; reviews: number; photos: number; aiMatches: number };
  visitas: VisitasPanel;
  publicaciones: { usadas: number; tope: number };
  plan: Plan;
  funciones: Funcion[];
  modulos: ClaveModulo[];
  negocios: { id: string; nombre: string }[];
  permisos: PermisoNegocio[];
}

export interface PerfilSnapshotData {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    imageUrl: string | null;
    locationCity: string | null;
  };
  preferences: {
    name: string;
    email: string;
    phone: string;
    avatarUrl?: string;
    location: string;
    locationName: string;
    interests: string[];
    moods: string[];
    currencies: string[];
    onboardingCompleted: boolean;
  };
}

interface NegocioSnapshotArgs {
  place: UserPlace;
  stats: NegocioSnapshotData["stats"];
  visitas: VisitasPanel;
  publicaciones: NegocioSnapshotData["publicaciones"];
  plan: Plan;
  funciones: Funcion[];
  modulos: ClaveModulo[];
  negocios: { id: string; nombre: string; esPrueba?: boolean }[];
  permisos: PermisoNegocio[];
}

/** Copia de lectura del panel del negocio, sin campos internos ni binarios. */
export function construirNegocioSnapshot({
  place,
  stats,
  visitas,
  publicaciones,
  plan,
  funciones,
  modulos,
  negocios,
  permisos,
}: NegocioSnapshotArgs): NegocioSnapshotData {
  return {
    place: {
      id: place.id,
      slug: place.slug,
      name: place.name,
      description: place.description,
      address: place.address,
      city: place.city,
      province: place.province,
      phone: place.phone,
      whatsapp: place.whatsapp,
      schedule: place.schedule,
      status: place.status,
      logoUrl: place.logoUrl,
      photos: (place.photos ?? []).map((foto) => ({ url: foto.url, alt: foto.alt })),
      menu: (place.menu ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        currency: item.currency,
        category: item.category,
        disponibilidad: item.disponibilidad,
        agotadoHasta: item.agotadoHasta ?? null,
        image: item.image,
      })),
    },
    stats,
    visitas,
    publicaciones,
    plan,
    funciones,
    modulos,
    negocios: negocios.map((negocio) => ({ id: negocio.id, nombre: negocio.nombre })),
    permisos,
  };
}

/** Perfil y preferencias del usuario, sin credenciales ni sesión. */
export function construirPerfilSnapshot({
  user,
  preferences,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    imageUrl?: string | null;
    locationCity?: string | null;
  };
  preferences: {
    name: string;
    email: string;
    phone: string;
    avatarUrl?: string;
    location: string;
    locationName: string;
    interests: string[];
    moods: string[];
    currencies: string[];
    onboardingCompleted: boolean;
  };
}): PerfilSnapshotData {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      imageUrl: user.imageUrl ?? null,
      locationCity: user.locationCity ?? null,
    },
    preferences: {
      name: preferences.name,
      email: preferences.email,
      phone: preferences.phone,
      avatarUrl: preferences.avatarUrl,
      location: preferences.location,
      locationName: preferences.locationName,
      interests: preferences.interests,
      moods: preferences.moods,
      currencies: preferences.currencies,
      onboardingCompleted: preferences.onboardingCompleted,
    },
  };
}
